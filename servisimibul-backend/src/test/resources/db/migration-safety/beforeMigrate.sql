create table test_harness.unsafe_migration_guard_probe (
    executed_at timestamptz not null default now()
);
