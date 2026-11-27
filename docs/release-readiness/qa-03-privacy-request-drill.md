# QA-03 privacy-request tabletop drill — plan

Status: **PLANNED — NOT PERFORMED.** No participant, date or result exists yet. Do not record results here until the drill has actually been run.

Procedure source: [`23_DATA_SUBJECT_REQUESTS.md`](../23_DATA_SUBJECT_REQUESTS.md) (draft). Lifecycle and erasure: [`24`](../24_ACCOUNT_LIFECYCLE_POLICY.md), [`20`](../20_RETENTION_AND_ERASURE.md), [`31`](../31_APP_11_ERASURE_SAFETY.md).

## Preconditions (a drill run without them is invalid)

- [ ] Controller and monitored channel decided (L1, L2, RQ1). The drill uses that channel's **test path** or a stand-in agreed in writing.
- [ ] Handler and deputy named (RQ1 person; LEG-06 service level owner).
- [ ] Counsel available for RQ2–RQ4 judgments, or explicitly marked as "simulated" in the record.
- [ ] Disposable environment only (`dev.ps1`, D045), with `SB_DATA_RIGHTS_ENABLED=true` set **only** there. Production and shared Supabase are never touched.
- [ ] Synthetic identities only, for example `drill-parent-01@example.invalid`. No real names, T.C. numbers, phones or addresses.

## Format

A facilitator reads injects. Participants say what they would do and where they would record it. Time compression: one drill hour stands for 30 calendar days. Every statutory and internal date is computed and written down, even in simulation.

## Scenarios

| # | Inject | Expected decision points | Pass criteria |
|---|---|---|---|
| P1 | Synthetic parent asks through the channel for a copy of their data | Is it a KVKK Art. 11 request (RQ2)? Which date is the application date (RQ3)? Identity check method (RQ4)? | Logged within the internal service level, with deadline = application date + 30 days written down |
| P2 | Incomplete request with no identifying detail | Clarification request; effect on the clock (RQ3) | Clarification sent from an approved template (RQ5); clock handling recorded with counsel's rule |
| P3 | Synthetic operator requests erasure, but has a published profile and a moderation case | Shared records (R3), moderation snapshots (P5, AQ5), backups (R4), legal hold (R5) | Decision recorded with reasons. Nothing claims deletion that did not happen (APP-11 fail-closed). |
| P4 | Third party claims to act for a parent | Representative authority (RQ4) | Proof requested; no data released without it |
| P5 | Response email bounces | Delivery failure; when is a request "answered" (RQ6)? | Fallback recorded per RQ6 |
| P6 | Handler unavailable on day 25 | Deputy escalation | Deputy completes it before day 30; escalation timestamp recorded |

## Evidence to record per run (fill only after the drill)

| Field | Value |
|---|---|
| Date and duration | `[NOT PERFORMED]` |
| Facilitator / participants (roles) | `[NOT PERFORMED]` |
| Environment and commit | `[NOT PERFORMED]` |
| Scenarios run, and result per scenario (pass/fail + reason) | `[NOT PERFORMED]` |
| Deadlines computed vs. expected | `[NOT PERFORMED]` |
| Gaps found and follow-up owners | `[NOT PERFORMED]` |
| Sign-off (handler, owner) | `[NOT PERFORMED]` |

A real (non-simulated) end-to-end test submission on the approved production channel is required separately by RQ1 ("dated test submission") and issue #225. It must also use synthetic content.
