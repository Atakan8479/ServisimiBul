"""Local-only application-role connection quarantine rehearsal.

This module is deliberately NOT a production release tool: no remote host is
accepted, and the required isolated test_harness marker does not exist on the
Supabase project. It does not run Flyway or touch a shared database.
"""
import ipaddress
import re

PRODUCTION_SYSTEM_ID = "7692130048193495360"
RUNTIME_ROLE = "servisimibul_app"
TEST_DATABASE = "ops01_freeze_test"


def require_disposable_target(host: str, database: str, system_id: str,
                              marker: str) -> None:
    try:
        address = ipaddress.ip_address(host)
    except ValueError as exc:
        raise ValueError("Only numeric loopback PostgreSQL hosts are accepted") from exc
    if not address.is_loopback:
        raise ValueError("Only a loopback PostgreSQL host is accepted")
    if database != TEST_DATABASE:
        raise ValueError("Only the named isolated test database is accepted")
    if not re.fullmatch(r"[0-9]{10,30}", system_id) or system_id == PRODUCTION_SYSTEM_ID:
        raise ValueError("Production or unverified PostgreSQL system ID denied")
    if not re.fullmatch(r"ops01_disposable_[a-z0-9]{8,32}", marker):
        raise ValueError("A unique disposable test_harness marker is required")


def check_disposable(conn, expected_id: str, expected_marker: str) -> None:
    observed = conn.execute(
        "select system_identifier::text from pg_control_system()"
    ).fetchone()[0]
    recovery = conn.execute("select pg_is_in_recovery()").fetchone()[0]
    role = conn.execute("select current_user").fetchone()[0]
    marker_row = conn.execute(
        "select instance_id from test_harness.database_instance"
    ).fetchall()
    if observed != expected_id or recovery or role != "postgres" or len(marker_row) != 1:
        raise RuntimeError("Local cluster identity or authorized operator mismatch")
    if marker_row[0][0] != expected_marker:
        raise RuntimeError("Isolated test marker mismatch")


def quarantine(conn) -> int:
    """Stop the current app sessions and deny future direct role logins."""
    row = conn.execute(
        "select rolcanlogin, rolsuper, rolcreatedb, rolcreaterole "
        "from pg_roles where rolname=%s", (RUNTIME_ROLE,)
    ).fetchone()
    if row != (True, False, False, False):
        raise RuntimeError("Expected restricted login role missing or already altered")
    # Test cluster only: authoritatively shut down any existing sessions before
    # demonstrating that a new authenticated runtime connection is rejected.
    conn.execute("alter role servisimibul_app nologin")
    terminated = conn.execute(
        "select count(*) from pg_stat_activity "
        "where usename=%s and datname=current_database() and pid<>pg_backend_pid()",
        (RUNTIME_ROLE,),
    ).fetchone()[0]
    conn.execute(
        "select pg_terminate_backend(pid) from pg_stat_activity "
        "where usename=%s and datname=current_database() and pid<>pg_backend_pid()",
        (RUNTIME_ROLE,),
    ).fetchall()
    remaining = conn.execute(
        "select count(*) from pg_stat_activity "
        "where usename=%s and datname=current_database() and pid<>pg_backend_pid()",
        (RUNTIME_ROLE,),
    ).fetchone()[0]
    if remaining:
        raise RuntimeError("Could not terminate all local runtime sessions")
    return terminated


def restore_login(conn) -> None:
    """Re-enable the test account even after a failed rehearsal."""
    conn.execute("alter role servisimibul_app login")
    val = conn.execute(
        "select rolcanlogin from pg_roles where rolname=%s", (RUNTIME_ROLE,)
    ).fetchone()
    if val is None or val[0] is not True:
        raise RuntimeError("Isolated runtime role login was not restored")
