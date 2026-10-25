import unittest
from ops_project_recovery_assessment import assess, EXPECTED_REF, EXPECTED_SYSTEM

class ProjectRecoveryTests(unittest.TestCase):
    def base(self):
        return dict(project_ref=EXPECTED_REF, system_identifier=EXPECTED_SYSTEM,
                    postgres_major=17,flyway_success=12,auth_users=0,
                    storage_buckets=0,storage_objects=0,application_users=3,
                    public_backup_sha256="a"*64,public_restore_v15_pass=True)
    def test_zero_auth_storage_still_denies_platform_recovery(self):
        result=assess(self.base())
        self.assertFalse(result["full_supabase_platform_restore_verified"])
        self.assertFalse(result["production_go_live_authorized"])
        self.assertTrue(result["public_application_restore_verified"])
    def test_auth_and_storage_data_extend_recovery_scope(self):
        v=self.base()
        v.update(auth_users=1, storage_objects=2)
        result=assess(v)
        self.assertTrue(any("Auth identities" in x for x in result["blockers"]))
        self.assertTrue(any("Storage metadata" in x for x in result["blockers"]))
    def test_rehearsal_required(self):
        v=self.base();v["public_restore_v15_pass"]=False
        with self.assertRaises(ValueError):assess(v)
    def test_wrong_identity_rejected(self):
        v=self.base();v["system_identifier"]="123"
        with self.assertRaises(ValueError):assess(v)

if __name__=="__main__":unittest.main()
