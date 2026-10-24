import importlib.util
import threading
import tempfile
import subprocess
import os
import sys
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from ops_disposable_lock_coordinator import lock_key, require_loopback, run_isolated

class OfflineLeaseTests(unittest.TestCase):
    def test_deterministic_lock(self):
        self.assertEqual(lock_key("abcdefghijklmnopqrst"), lock_key("abcdefghijklmnopqrst"))
        self.assertNotEqual(lock_key("abcdefghijklmnopqrst"), lock_key("abcdefghijklmnopqrsu"))
    def test_production_hosts_denied(self):
        for host in ("db.whftdzfbvpchmghttjkg.supabase.co", "aws-0-eu-west-1.pooler.supabase.com", "8.8.8.8", "localhost"):
            with self.assertRaises(ValueError):
                require_loopback(host)
    def test_loopback_allowed(self):
        require_loopback("127.0.0.1")
        require_loopback("::1")

@unittest.skipUnless(os.environ.get("SB_LOCK_TEST_DSN"), "No disposable test DSN supplied")
class IsolatedLeaseIntegration(unittest.TestCase):
    def test_lock_session_loss_terminates_child(self):
        import psycopg
        url = os.environ["SB_LOCK_TEST_DSN"]
        password = os.environ["PGPASSWORD"]
        system_id = os.environ["SB_LOCK_TEST_SYSTEM_ID"]
        ref = "abcdefghijklmnopqrst"
        with tempfile.TemporaryDirectory() as tmp:
            marker = os.path.join(tmp, "started")
            script = ("from pathlib import Path;import time;"
                      "Path(" + repr(marker) + ").write_text('started');time.sleep(35)")
            def kill_session():
                with psycopg.connect(url, password=password, autocommit=True) as admin:
                    deadline = time.monotonic() + 9
                    while time.monotonic() < deadline:
                        found = admin.execute(
                            "select pid from pg_locks where granted and locktype='advisory' and objid=%s::oid",
                            (lock_key(ref) & 0xffffffff,),
                        ).fetchone()
                        if found and os.path.isfile(marker):
                            admin.execute("select pg_terminate_backend(%s)", (found[0],))
                            return
                        time.sleep(0.07)
                    raise AssertionError("Failed to observe disposable lock holder")
            with ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(kill_session)
                start = time.monotonic()
                with self.assertRaisesRegex(RuntimeError, "connection lost"):
                    run_isolated("127.0.0.1", int(os.environ["SB_LOCK_TEST_PORT"]),
                                 os.environ["SB_LOCK_TEST_DATABASE"],
                                 os.environ["SB_LOCK_TEST_USER"], ref, system_id,
                                 [sys.executable, "-c", script], 0.1)
                future.result(timeout=12)
                self.assertLess(time.monotonic() - start, 15)

    def test_conflict_and_release(self):
        import psycopg
        url = os.environ["SB_LOCK_TEST_DSN"]
        system_id = os.environ["SB_LOCK_TEST_SYSTEM_ID"]
        password = os.environ["PGPASSWORD"]
        ref = "abcdefghijklmnopqrst"
        with psycopg.connect(url, password=password, autocommit=True) as keeper:
            keeper.execute("select pg_advisory_lock(%s::bigint)", (lock_key(ref),))
            with self.assertRaisesRegex(RuntimeError, "already held"):
                run_isolated("127.0.0.1", int(os.environ["SB_LOCK_TEST_PORT"]),
                             os.environ["SB_LOCK_TEST_DATABASE"], os.environ["SB_LOCK_TEST_USER"],
                             ref, system_id, [sys.executable,"-c","pass"])
            keeper.execute("select pg_advisory_unlock(%s::bigint)", (lock_key(ref),))
        result=run_isolated("127.0.0.1", int(os.environ["SB_LOCK_TEST_PORT"]),
                            os.environ["SB_LOCK_TEST_DATABASE"], os.environ["SB_LOCK_TEST_USER"],
                            ref, system_id, [sys.executable,"-c","pass"])
        self.assertEqual(result, 0)

if __name__ == "__main__":
    unittest.main()
