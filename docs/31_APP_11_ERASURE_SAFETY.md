# APP-11 — erasure safety scaffold

APP-11 is limited to a disabled, reversible safety scaffold while LEG-03 and LEG-07 remain pending. It does not choose retention periods, decide whether a category is deleted or anonymized, execute erasure, or change production configuration.

The implementation must fail closed and prove on disposable PostgreSQL that:

- every direct `app_user` foreign key is classified before execution;
- shared demands, comments, reports, moderation cases, and audit events are preserved;
- a plain account delete remains blocked by `ON DELETE RESTRICT` references;
- repeated or concurrent preparation produces one stable plan;
- a failed preparation rolls back completely; and
- no plan is executable until the legal-policy gates are replaced by approved decisions and a separately reviewed migration.

This document records implementation boundaries only. It is not a retention, erasure, anonymization, legal-hold, or legal-basis decision.
