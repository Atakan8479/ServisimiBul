import unittest
from ops_recovery_coverage import evaluate

class CoverageTests(unittest.TestCase):
    def test_public_only_never_claims_platform_recovery(self):
        toc = "; Format: CUSTOM\n12; 1259 1 TABLE public flyway_schema_history postgres\n13; 0 1 TABLE DATA public flyway_schema_history postgres\n"
        result=evaluate(toc)
        self.assertEqual(result["logical_archive_schema_coverage"], ["public"])
        self.assertEqual(result["missing_required_schemas"], ["auth","realtime","storage","vault"])
        self.assertFalse(result["full_supabase_platform_recovery_proven"])
        self.assertIn("storage_objects_binary_payloads",result["unrecoverable_or_unverified_platform_components"])

    def test_even_many_schemas_do_not_prove_platform_recovery(self):
        toc = "; Format: CUSTOM\n" + "".join(
            f"{i}; 1259 {i} TABLE {schema} fixture postgres\n{i+20}; 0 {i} TABLE DATA {schema} fixture postgres\n"
            for i,schema in enumerate(("public","auth","storage","realtime","vault"),start=1))
        result=evaluate(toc)
        self.assertEqual(result["missing_required_schemas"], [])
        self.assertFalse(result["full_supabase_platform_recovery_proven"])

    def test_missing_table_data_detected(self):
        result=evaluate("22; 1259 2 TABLE public accounts postgres\n")
        self.assertEqual(result["tables_without_data_entries"],["public.accounts"])

if __name__=="__main__":
    unittest.main()
