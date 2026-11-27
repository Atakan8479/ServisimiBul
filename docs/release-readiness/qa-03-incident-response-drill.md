# QA-03 security-incident and breach tabletop drill — plan

Status: **PLANNED — NOT PERFORMED.** No participant, date or result exists yet.

Procedure source: [`29_BREACH_INCIDENT_RESPONSE.md`](../29_BREACH_INCIDENT_RESPONSE.md) §4–§9 (draft). Recovery: [`10_DATABASE_AND_BACKUP_OPERATIONS.md`](../10_DATABASE_AND_BACKUP_OPERATIONS.md), [`07_BACKEND_DEPLOYMENT.md`](../07_BACKEND_DEPLOYMENT.md).

**No real notification is sent during a drill.** No message goes to the Authority (KVKK Board), to data subjects or to vendors. Notification drafts are written to the drill record only, marked `DRILL`.

## Preconditions

- [ ] Roles named per [`29`](../29_BREACH_INCIDENT_RESPONSE.md) §4: incident lead + deputy, legal assessor, notification decision-maker + deputy, recovery owner.
- [ ] Counsel's rule for when the controller "learns" of a breach (IQ2) and the risk criteria, or explicit "simulated" marking.
- [ ] Incident ledger location agreed (`[PENDING: owner + counsel]`). For the drill, use a scratch copy of the [`29`](../29_BREACH_INCIDENT_RESPONSE.md) §7 template.
- [ ] Any technical step (session revocation, operator suspension, credential rotation) is executed **only** in a disposable environment, through its existing authorized path.

## Scenarios

| # | Inject (synthetic) | Decision points | Pass criteria |
|---|---|---|---|
| I1 | A developer finds the shared-DB runtime password in a public CI log | Suspected breach? Containment: rotate the credential, stop deploys (`10` steps 1–2). Scope: which LEG-02 categories were reachable? | Ledger opened. All candidate times recorded (detection, escalation, confirmation). Rotation owner named. |
| I2 | Supabase notifies of a subprocessor incident affecting the project region | Processor report as a "learning" point (IQ2); vendor contact (V1, V8) | 72-hour deadline computed from the earliest candidate time; vendor contact path known |
| I3 | A parent reports that another user's comment exposes a child's name and school | Moderation (D053 hide) vs. breach assessment; categories 12/13 | Comment hidden via the admin path. Breach assessment recorded with reasons, whatever the outcome. |
| I4 | Suspected session hijack of several parent accounts | **Capability gap:** no global session revocation and no admin disable for parents (`29` §3.3) | Gap recorded. Workaround and its limits stated. Follow-up owner assigned. |
| I5 | Facts still incomplete at hour 60 | Staged Board notification (2019/10) | Decision-maker (or deputy) approves a staged draft before hour 72. Reasons for any missing fields recorded. |
| I6 | Recovery requires restoring a backup | `10` restore steps; erasure reconciliation (APP-12) | Restore plan with target, recovery point and approver written. No restore over a populated target. |

## Evidence to record per run (fill only after the drill)

| Field | Value |
|---|---|
| Date and duration | `[NOT PERFORMED]` |
| Participants (roles) | `[NOT PERFORMED]` |
| Scenarios run and per-scenario result | `[NOT PERFORMED]` |
| Time from inject to escalation; 72-hour deadline computed | `[NOT PERFORMED]` |
| Containment actions actually exercised (disposable env, commit) | `[NOT PERFORMED]` |
| Capability gaps and follow-up owners | `[NOT PERFORMED]` |
| Sign-off (incident lead, notification decision-maker) | `[NOT PERFORMED]` |

Monitoring and alerting do not exist yet (matrix row 25). Until they do, detection in I1 and I4 depends on manual discovery. Record that as a residual risk of every run.
