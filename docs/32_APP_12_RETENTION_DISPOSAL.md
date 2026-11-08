# APP-12 — retention, controlled disposal, and restore reconciliation

APP-12 is legally gated by LEG-03. The category matrix in `docs/20_RETENTION_AND_ERASURE.md` remains entirely pending, so this work must not invent retention durations, disposal methods, legal-hold rules, evidence retention, or backup expiry. This document defines the technical contract that can be built and tested safely before those decisions are approved.

## Current implementation boundary

- No scheduled or manual disposal may execute against application data.
- No database migration, production flag, provider setting, backup deletion, or live Supabase operation is authorized.
- Existing account-erasure execution remains unavailable. APP-11's `LEG-03` and `LEG-07` blockers remain authoritative.
- Existing ADMIN role, handler assignment, identity-verification, session, and CSRF protections remain unchanged.
- Tests may mutate only synthetic data in disposable, loopback PostgreSQL instances and must restore or destroy all temporary state.

## Fail-closed policy contract

Every retention category must eventually have an approved, versioned rule containing its LEG-02 category, trigger, duration or deadline, disposal method, owner, exceptions, legal-hold behavior, and approval evidence reference. A category with a missing field, unknown value, expired approval, or unrecognized policy version is blocked; it must never fall back to a universal duration or default deletion method.

The first implementation slice may validate and report policy readiness, but it must expose no disposal executor while the matrix is pending. Later execution requires a separately reviewed migration for durable run/evidence records and explicit production activation.

## Controlled-disposal contract

An approved executor must eventually provide all of the following as one reviewed transaction boundary:

1. select only records covered by one approved category rule and trigger;
2. stop on legal holds, shared-record review requirements, schema drift, or stale policy versions;
3. record attempt, rule version, method, aggregate row counts, actor/job identity, result, and error without copying disposed personal data;
4. make retries idempotent and distinguish retryable failures from permanent policy blocks; and
5. commit disposal and its evidence together, or roll both back.

Until the evidence location and retention are approved under LEG-03 R6, no production audit record or job is created.

## Backup restore reconciliation contract

A restore must remain offline until every erasure or disposal obligation created after the selected backup point has been reapplied and verified. The reconciliation source must live outside the restored backup, be integrity checked, contain only the approved minimum identifiers, and fail closed when it is missing, unreadable, newer than the supported format, or incomplete for the restore interval.

The existing A-13 drill may rehearse this sequence with synthetic data in two disposable PostgreSQL instances. Such a drill proves mechanics only; it does not approve the external reconciliation store, its identifiers or retention, a production restore, or a recovery-time objective.

## Approval and delivery sequence

1. Owner and qualified counsel approve LEG-03 R1–R6 and R8 and record the category matrix.
2. A reviewed PR adds the versioned policy and any required durable schema.
3. Disposable PostgreSQL tests prove selection, legal holds, rollback, idempotent retries, evidence, and restore reconciliation.
4. A separate release decision enables any scheduler or production operation.

Issue #219 remains open until the approved matrix, controlled execution, evidence retention, and production restore procedure exist and pass their release gates.
