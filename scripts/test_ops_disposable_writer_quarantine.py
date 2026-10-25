import os
import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).parent))
from ops_disposable_writer_quarantine import require_disposable_target,check_disposable,quarantine,restore_login

class GuardTests(unittest.TestCase):
    def test_reject_shared_endpoints(self):
        for host in ("db.whftdzfbvpchmghttjkg.supabase.co","8.8.8.8","localhost"):
            with self.assertRaises(ValueError):
                require_disposable_target(host,"ops01_freeze_test","1234567890123456789","ops01_disposable_abcd1234")
    def test_reject_live_system_id(self):
        with self.assertRaises(ValueError):
            require_disposable_target("127.0.0.1","ops01_freeze_test","7692130048193495360","ops01_disposable_abcd1234")
    def test_loopback_fixture(self):
        require_disposable_target("127.0.0.1","ops01_freeze_test","1234567890123456789","ops01_disposable_abcd1234")

@unittest.skipUnless(os.getenv("SB_QUARANTINE_DSN"),"Disposable database not supplied")
class LiveIsolatedTests(unittest.TestCase):
    def test_quarantine_and_restore(self):
        import psycopg
        kw=dict(host="127.0.0.1",port=int(os.environ["SB_QUARANTINE_PORT"]),
                dbname="ops01_freeze_test",user="postgres",
                password=os.environ["PGPASSWORD"],autocommit=True)
        with psycopg.connect(**kw) as admin:
            identity=admin.execute("select system_identifier::text from pg_control_system()").fetchone()[0]
            require_disposable_target("127.0.0.1","ops01_freeze_test",identity,"ops01_disposable_abcd1234")
            check_disposable(admin,identity,"ops01_disposable_abcd1234")
            runtime=dict(kw,user="servisimibul_app",password="test-only")
            app=psycopg.connect(**runtime)
            try:
                self.assertEqual(quarantine(admin),1)
                with self.assertRaises(psycopg.OperationalError):
                    app.execute("select 1")
                with self.assertRaises(psycopg.OperationalError):
                    psycopg.connect(**runtime)
            finally:
                app.close()
                restore_login(admin)
            with psycopg.connect(**runtime) as again:
                self.assertEqual(again.execute("select 1").fetchone()[0],1)

if __name__=="__main__":
    unittest.main()
