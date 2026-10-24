#!/usr/bin/env python3
"""Isolated-only PostgreSQL migration lease coordinator.

No production endpoint, project credential, or live migration is accepted.
GitHub approvals and maintenance windows must be independently implemented
before a production runner can be considered.
"""
import argparse
import hashlib
import ipaddress
import os
import subprocess
import sys
import time


def lock_key(project_ref: str) -> int:
    if len(project_ref) != 20 or not project_ref.isalnum() or project_ref != project_ref.lower():
        raise ValueError("Invalid project identity")
    value = hashlib.sha256(("ServisimiBul/OPS-01/" + project_ref).encode()).digest()[:8]
    return int.from_bytes(value, "big", signed=True)


def require_loopback(host: str) -> None:
    try:
        if not ipaddress.ip_address(host).is_loopback:
            raise ValueError("Only an explicit loopback PostgreSQL target is supported")
    except ValueError as exc:
        raise ValueError("Only numeric loopback PostgreSQL addresses are permitted") from exc


def lock_owned(connection, key: int, pid: int) -> bool:
    # A dedicated session owns only our application advisory lock.
    upper = (key & ((1 << 64) - 1)) >> 32
    lower = key & 0xFFFFFFFF
    return connection.execute(
        """select exists (
          select 1 from pg_locks
          where pid=pg_backend_pid() and locktype='advisory'
            and mode='ExclusiveLock' and granted
            and classid=%s::oid and objid=%s::oid
        ) and pg_backend_pid()=%s""",
        (upper, lower, pid),
    ).fetchone()[0]


def run_isolated(host: str, port: int, database: str, username: str,
                 project_ref: str, expected_system_id: str, command: list[str],
                 heartbeat_seconds: float = 0.25) -> int:
    import psycopg

    require_loopback(host)
    if not command or not command[0]:
        raise ValueError("Missing isolated test subprocess")
    if not expected_system_id.isdecimal() or not 10 <= len(expected_system_id) <= 30:
        raise ValueError("An explicit disposable PostgreSQL system ID is required")
    password = os.environ.get("PGPASSWORD")
    if not password:
        raise ValueError("PGPASSWORD is required; credentials must not be command arguments")
    key = lock_key(project_ref)
    process = None
    with psycopg.connect(host=host, port=port, dbname=database, user=username,
                         password=password, connect_timeout=4, sslmode="disable",
                         autocommit=True) as conn:
        observed = conn.execute("select system_identifier::text from pg_control_system()").fetchone()[0]
        recovery = conn.execute("select pg_is_in_recovery()").fetchone()[0]
        if observed != expected_system_id or recovery:
            raise RuntimeError("Disposable PostgreSQL target identity or primary status mismatch")
        acquired = conn.execute("select pg_try_advisory_lock(%s::bigint)", (key,)).fetchone()[0]
        if not acquired:
            raise RuntimeError("Migration coordinator lease is already held by another session")
        pid = conn.execute("select pg_backend_pid()").fetchone()[0]
        try:
            if not lock_owned(conn, key, pid):
                raise RuntimeError("Could not prove lock ownership on dedicated session")
            process = subprocess.Popen(command, stdin=subprocess.DEVNULL)
            while process.poll() is None:
                time.sleep(heartbeat_seconds)
                try:
                    if not lock_owned(conn, key, pid):
                        raise RuntimeError("Migration lock ownership lost while subprocess was running")
                except Exception as exc:
                    raise RuntimeError("Migration coordinator database connection lost") from exc
            return process.returncode
        finally:
            if process is not None and process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait(timeout=3)
            # Never unlock on a different/pooled connection.
            # Session close releases all outstanding session advisory locks.
            if not conn.closed:
                conn.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="DISPOSABLE LOCAL POSTGRES ONLY")
    parser.add_argument("--host", required=True)
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--database", required=True)
    parser.add_argument("--user", required=True)
    parser.add_argument("--project-ref", required=True)
    parser.add_argument("--expected-system-id", required=True)
    parser.add_argument("--heartbeat", type=float, default=0.25)
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.heartbeat <= 0 or args.heartbeat > 2:
        raise ValueError("Invalid heartbeat interval")
    command = args.command[1:] if args.command and args.command[0] == "--" else args.command
    return run_isolated(args.host, args.port, args.database, args.user,
                        args.project_ref, args.expected_system_id,
                        command, args.heartbeat)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        # No arguments, server output, SQL payloads or credentials in diagnostics.
        print("Isolated migration lease DENIED: " + str(exc)[:170], file=sys.stderr)
        sys.exit(3)
