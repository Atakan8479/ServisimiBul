# APP-11 — erasure safety scaffold

APP-11 is limited to a disabled, reversible safety scaffold while LEG-03 and LEG-07 remain pending. It does not choose retention periods, decide whether a category is deleted or anonymized, execute erasure, or change production configuration.

The implementation must fail closed and prove on disposable PostgreSQL that:

- every direct `app_user` foreign key is classified before execution;
- shared demands, comments, reports, moderation cases, and audit events are preserved;
- a plain account delete remains blocked by `ON DELETE RESTRICT` references;
- repeated or concurrent reads produce the same count/classification snapshot while the underlying rows are unchanged;
- a failed preparation rolls back completely; and
- no plan is executable until the legal-policy gates are replaced by approved decisions and a separately reviewed migration.

This document records implementation boundaries only. It is not a retention, erasure, anonymization, legal-hold, or legal-basis decision.

## Inventory boundary

The safety plan inventories only foreign keys whose referencing column points directly to `app_user.id`. It does not recursively traverse indirect relationships. Future approved erasure design must separately review at least:

- `operator_profile` descendants: operator-school relationships and coverage, vehicles, offerings and offering coverage, service responses and publication history, and application reviews;
- `demand` descendants: supports and reasons, comments, service responses/publications, feedback and lifecycle events, reports/moderation cases, and notifications;
- `demand_support`, `demand_comment`, `demand_service_response`, and `moderation_case` descendants, including feedback, reasons, reports, audit events, publication events, and notifications; and
- `data_rights_request` descendants such as request events, plus Spring Session rows that identify the account through serialized session attributes rather than a relational `app_user` foreign key.

The endpoint computes a fresh read-only snapshot on every call; it does not persist a plan or promise repeatable-read stability while application data changes concurrently.
