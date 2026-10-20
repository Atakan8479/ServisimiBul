# J-05 controlled pilot UAT

Status: preparation complete; human sessions not yet executed.

This runbook validates the MVP with supervised users in a disposable, local-only environment. It is not production approval, a public launch, or permission to use a shared Supabase project.

## Safety boundary

- One facilitator-controlled Windows workstation; Spring Boot, Vite, and PostgreSQL bind only to `127.0.0.1`.
- Synthetic data only. Never enter a real name, email, phone number, school relationship, student record, home address, credential, or private operational fact.
- Participants use codes such as `OP-01` and `PA-01`. Raw observation notes belong under ignored `.uat-private/`; only anonymized findings may enter Git.
- Use unique `@example.test` email addresses and facilitator-provided temporary passwords. Use non-routable display numbers such as `+10000000101`; do not activate telephone links.
- Do not enable SMTP, expose a tunnel/LAN listener, use paid hosting, connect to Supabase, import production data, or change production settings.
- Stop immediately for suspected real-data entry, security/privacy exposure, destructive behavior, or an environment that is not loopback-only. End the runner; its cleanup deletes the database, generated credentials, and tariff volume.

## Prepare and start

Prerequisites are Java 21+, Node.js 24, PostgreSQL 17 tools, and frontend dependencies installed with `npm ci`.

```powershell
.\scripts\Start-ControlledPilot.ps1 -SmokeTest
.\scripts\Start-ControlledPilot.ps1
```

The command prints a random loopback URL after migrations, three synthetic schools, four neighborhoods, and a synthetic tariff are ready. Keep the terminal open. Press Ctrl+C after the session and verify that cleanup completes.

Use one fresh disposable run per operator/parent pair where practical. Never reuse participant passwords or record them in findings.

## Facilitation method

Before each session, explain that the product is an unfinished local prototype, no real data may be entered, participation is voluntary, and notes will be anonymized. Obtain verbal consent for observation; do not make audio/video recordings under this procedure.

Give the participant the goal, not click-by-click instructions. The facilitator may answer safety questions but should record product confusion before helping. Capture:

- participant code and role;
- scenario result: completed unaided, completed with help, abandoned, or blocked;
- approximate completion time and the step where help was needed;
- anonymized observation, expected behavior, reproducible steps, severity, and proposed owner;
- whether the participant correctly distinguished school location from pickup neighborhood.

Never copy session cookies, passwords, email addresses, or entered phone values into notes, screenshots, issues, or the report.

## Operator scenarios

Target three to five synthetic operator sessions; this is a recruitment target, not an automatic pass condition.

1. Register a synthetic operator, sign in, and decide whether the profile is public.
2. Save the required public contact phone and optional business information.
3. Attach `J05 Moda Deneme Okulu` and cover both `Moda` and cross-district `Acıbadem`.
4. Confirm the workspace explains readiness and incomplete steps clearly.
5. Publish the profile without creating a Vehicle or ServiceOffering; both are optional.
6. If time permits, add an offering and verify its neighborhoods stay within the school's general coverage.

Expected product truths: the operator need not be a driver, may serve multiple schools, can be discoverable without a vehicle/offering, and cannot save cross-province or out-of-coverage data.

## Parent scenarios

Target five to ten synthetic parent sessions; this is a recruitment target, not an automatic pass condition. Parent discovery requires no account.

1. Find `J05 Moda Deneme Okulu` by school-location province/district and search with pickup neighborhood `Acıbadem`.
2. Explain in their own words why the school district and pickup district may differ within İstanbul.
3. Identify the matching operator and its contact action without exposing an email address.
4. Search an uncovered combination, such as the same school with `İçerenköy`, and interpret the no-match state.
5. Review the UKOME reference and explain that it is an official distance-band reference, not a personal quote or inferred route distance.

## Finding severity and ownership

| Severity | Definition | Exit impact |
|---|---|---|
| Release blocker | Privacy/security failure, data loss, or a critical journey cannot complete | Mandatory no-go |
| High | Core journey needs facilitator workaround or communicates a product invariant incorrectly | No-go until fixed and re-tested |
| Medium | Material confusion or accessibility friction with a reasonable workaround | Owner and follow-up required |
| Low | Cosmetic or minor copy friction | May defer with rationale |

Owners are `frontend`, `backend`, `data/operations`, or `product/content`. Every blocker/high finding needs reproducible steps and a linked follow-up before sign-off.

## Exit decision

J-05 may be marked locally complete only after supervised sessions are recorded in `docs/15_CONTROLLED_PILOT_UAT_REPORT.md`, there are no open release blockers/high findings, critical operator and parent flows pass, and the disposable environment's startup and cleanup are proven. The decision must explicitly say `GO — local controlled pilot evidence only` or `NO-GO`.

Even a J-05 go does not approve production. Repository protection verification, provider selection, monitoring/alerts, durable tariff storage, production migration/backup/restore rehearsal, deployment/rollback rehearsal, and any separately approved launch gates remain outstanding.
