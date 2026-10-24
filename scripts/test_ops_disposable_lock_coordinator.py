import importlib.util
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
