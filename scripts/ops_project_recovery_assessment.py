#!/usr/bin/env python3
"""Fail-closed assessment of a sanitized, read-only Supabase recovery inventory."""
import argparse
import json
from pathlib import Path

EXPECTED_REF = "whftdzfbvpchmghttjkg"
EXPECTED_SYSTEM = "7692130048193495360"

def assess(record):
    fields = ("project_ref","system_identifier","postgres_major","flyway_success",
              "auth_users","storage_buckets","storage_objects","application_users",
              "public_backup_sha256","public_restore_v15_pass")
    if any(key not in record for key in fields):
        raise ValueError("Required inventory evidence missing")
    if record["project_ref"] != EXPECTED_REF or record["system_identifier"] != EXPECTED_SYSTEM:
        raise ValueError("Wrong Supabase project or database identity")
    for name in ("postgres_major","flyway_success","auth_users","storage_buckets",
                 "storage_objects","application_users"):
        if type(record[name]) is not int or record[name] < 0:
            raise ValueError("Inventory counters must be nonnegative integers")
    sha = record["public_backup_sha256"]
    if not isinstance(sha,str) or len(sha) != 64 or any(c not in "0123456789abcdef" for c in sha):
        raise ValueError("An exact backup SHA-256 is required")
    if record["postgres_major"] != 17 or record["flyway_success"] != 12:
        raise ValueError("Current source is not PostgreSQL 17 / Flyway V12")
    if record["public_restore_v15_pass"] is not True:
        raise ValueError("Independent V12-to-V15 disposable rehearsal missing")
    blockers = [
        "No independently rehearsed complete platform recovery",
        "No independently established maintenance freeze and all-writers exclusion",
        "Production migration executor and independently authenticated approval still disabled",
    ]
    if record["auth_users"]:
        blockers.append("Auth identities require separately rehearsed recovery")
    if record["storage_objects"] or record["storage_buckets"]:
        blockers.append("Storage metadata and binary objects require separate recovery")
    return {
        "project_ref": record["project_ref"],
        "application_users": record["application_users"],
        "auth_users": record["auth_users"],
        "storage_buckets": record["storage_buckets"],
        "storage_objects": record["storage_objects"],
        "public_application_restore_verified": True,
        "full_supabase_platform_restore_verified": False,
        "production_go_live_authorized": False,
        "blockers": blockers,
    }

def main():
    p=argparse.ArgumentParser(description="Offline sanitized recovery risk evaluation")
    p.add_argument("--input",required=True)
    p.add_argument("--output",required=True)
    a=p.parse_args()
    source=Path(a.input)
    target=Path(a.output)
    if not source.is_file() or not target.parent.is_dir() or target.exists():
        raise ValueError("Private inventory input and new output destination required")
    result=assess(json.loads(source.read_text(encoding="utf-8")))
    target.write_text(json.dumps(result,indent=2)+"\n",encoding="utf-8")
    print("APPLICATION RECOVERY: verified; FULL PLATFORM RECOVERY: unverified; GO-LIVE: DENIED")

if __name__=="__main__":
    main()
