#!/usr/bin/env python3
"""Strict manifest for a limited logical PostgreSQL recovery rehearsal.

Reports schema/coverage gaps. Never claims Supabase platform recoverability.
"""
import argparse
import json
import re
from pathlib import Path

SYSTEM_SCHEMAS = ("auth", "storage", "realtime", "vault")
PLATFORM_GAPS = (
    "storage_objects_binary_payloads",
    "auth_provider_secrets_and_jwt_signing_keys",
    "project_api_keys_and_secrets",
    "edge_functions_and_deployment_configuration",
    "database_roles_and_passwords",
    "full_platform_point_in_time_recovery",
)

def inventory(toc: str) -> dict:
    result = {"schemas": set(), "tables": set(), "table_data": set()}
    for line in toc.splitlines():
        match = re.match(r"^\s*\d+;\s+\d+\s+\d+\s+(SCHEMA|TABLE DATA|TABLE)\s+([^\s]+)\s+([^\s]+)", line)
        if not match:
            continue
        kind, schema, name = match.groups()
        if kind == "SCHEMA":
            result["schemas"].add(name)
        elif kind == "TABLE":
            result["schemas"].add(schema)
            result["tables"].add((schema, name))
        else:
            result["table_data"].add((schema, name))
    return result

def evaluate(toc: str, required: tuple[str, ...] = ("public",) + SYSTEM_SCHEMAS):
    rows = inventory(toc)
    missing = sorted(set(required) - rows["schemas"])
    empty = sorted(f"{s}.{t}" for s, t in rows["tables"] - rows["table_data"])
    return {
        "logical_archive_schema_coverage": sorted(rows["schemas"]),
        "missing_required_schemas": missing,
        "tables_without_data_entries": empty,
        "unrecoverable_or_unverified_platform_components": list(PLATFORM_GAPS),
        "full_supabase_platform_recovery_proven": False,
    }

def main():
    parser = argparse.ArgumentParser(description="Inspect a pg_restore --list text file")
    parser.add_argument("--toc-file", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    path = Path(args.toc_file)
    if not path.is_file() or not Path(args.output).parent.is_dir():
        raise ValueError("Input TOC and output folder must exist")
    report = evaluate(path.read_text(encoding="utf-8"))
    Path(args.output).write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("LOGICAL RECOVERY COVERAGE: partial, not full Supabase restoration.")
    if report["missing_required_schemas"]:
        print("Uncovered required schemas: " + ", ".join(report["missing_required_schemas"]))
    # This tool must never report a full-platform PASS.

if __name__ == "__main__":
    main()
