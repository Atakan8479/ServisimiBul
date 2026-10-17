# Backend deployment and observability runbook

This runbook covers the Spring Boot backend artifact. It does not authorize a production release or a database change. Every migration still requires the reviewed migration PR, current-state verification, a confirmed target, and explicit human approval required by `AGENTS.md`.

## Release contract

- Build and run with Java 21-compatible bytecode. CI uses Java 21; developer Maven may run on JDK 25.
- Serve the SPA and `/api/v1` from one HTTPS origin in production. Application CORS and Actuator CORS remain disabled.
- Terminate TLS at a trusted reverse proxy or load balancer. `SB_FORWARD_HEADERS_STRATEGY` defaults to `none`; change it only after the deployment platform's trusted-proxy behavior is reviewed.
- Store secrets in the deployment platform's secret manager. Do not put secret values in Git, image layers, command history, health responses, or logs.
- Run Flyway as a one-shot release step with migration credentials. Run the application with only the restricted `servisimibul_app` credentials and Flyway disabled.
- Deploy immutable JARs. Do not write tariff data or other persistent state inside an expanded or packaged application artifact.
- Run exactly one backend instance for the initial pilot. The platform must restart a failed process automatically; do not infer high availability from a single process.

## Build

From `servisimibul-backend`:

```sh
./mvnw --batch-mode verify
./mvnw --batch-mode -DskipTests package
```

The deployable artifact is `target/servisimibul-backend-0.0.1-SNAPSHOT.jar`. A release pipeline should assign an immutable artifact or image digest rather than rely on the snapshot filename alone.

## Environment variables

### Normal runtime

| Variable | Required | Purpose |
|---|---:|---|
| `SPRING_PROFILES_ACTIVE=prod` | yes | Activates production logging, SMTP, graceful shutdown, and secure-cookie enforcement. |
| `SB_DB_JDBC_URL` | yes | PostgreSQL JDBC URL with TLS required. |
| `SB_DB_USER=servisimibul_app` | yes | Least-privilege runtime login. Never use `postgres` or the migration identity. |
| `SB_DB_PASSWORD` | yes, secret | Runtime database password. |
| `SB_FLYWAY_ENABLED=false` | yes | Documents runtime intent. The `prod` profile also forces Flyway and effective migration connection settings off and fails startup if they are re-enabled. |
| `SB_MAIL_ENABLED=true` | yes | Enables the B-03 verification/recovery mail sender after the remaining mail settings are configured. |
| `SB_MAIL_HOST` | yes | SMTP host. |
| `SB_MAIL_PORT` | no | Defaults to `587`. |
| `SB_MAIL_USERNAME` | yes, secret | SMTP login. |
| `SB_MAIL_PASSWORD` | yes, secret | SMTP password. |
| `SB_MAIL_FROM` | yes | Verified sender address. |
| `SB_FRONTEND_BASE_URL` | yes | HTTPS frontend origin used to build verification/reset links. |
| `SB_MAIL_SMTP_AUTH` | no | Defaults to `true`; production rejects `false`. |
| `SB_MAIL_STARTTLS` | no | Defaults to `true`; production rejects `false`. |
| `SB_MAIL_STARTTLS_REQUIRED` | no | Defaults to `true`; production rejects `false`. |
| `SB_MAIL_CONNECTION_TIMEOUT_MS` | no | SMTP connect timeout; defaults to `5000`. |
| `SB_MAIL_READ_TIMEOUT_MS` | no | SMTP read timeout; defaults to `5000`. |
| `SB_MAIL_WRITE_TIMEOUT_MS` | no | SMTP write timeout; defaults to `5000`. |
| `SB_SERVER_PORT` | no | Defaults to `8080`. |
| `SB_LOG_LEVEL` | no | Root log level, default `INFO`. Do not use `DEBUG` or `TRACE` routinely in production. |
| `SB_SHUTDOWN_TIMEOUT` | no | Graceful shutdown window, default `30s`. |
| `SB_FORWARD_HEADERS_STRATEGY` | no | Defaults to `none`; set only for a reviewed trusted-proxy topology. |
| `SB_TARIFF_STORAGE_DIR` | yes | Backend-only durable writable tariff volume; never the repository, classpath, or packaged JAR. |
| `OPERATOR_APPROVAL_REQUIRED=false` | yes for the initial pilot | Explicitly bypasses application review waiting. The application default is safely `true`; omission therefore changes pilot behavior and must fail the release checklist. |

Rate-limit variables use the `SB_RATE_LIMIT_*` prefix. Defaults preserve login `10/account/15m` and `100/IP/15m`, registration/resend/recovery `20/IP/1h`, eligible resend/recovery `5/account/1h`, plus provisional verification `60/IP` and `5/token` per 15 minutes, reset `30/IP` and `5/token` per 15 minutes, and public search `120/IP/1m`. `SB_RATE_LIMIT_MAX_KEYS` and `SB_RATE_LIMIT_OVERFLOW_BUCKETS` bound memory. Treat all non-established values as staging defaults requiring measurement, not production-validated capacity.

Do not provide `SB_DB_MIGRATION_JDBC_URL`, `SB_DB_MIGRATION_USER`, or `SB_DB_MIGRATION_PASSWORD` to the normal runtime. An environment post-processor runs immediately after config-data loading and before auto-configuration: under `prod` it rejects any of those injected variables, effective Flyway connection settings, Flyway enablement, a combined `prod,migration` profile, or a runtime database user other than `servisimibul_app`. The `prod` profile additionally makes the effective Flyway URL/user/password empty and forces Flyway off. The separate `migration` profile remains authorized when `prod` is not active. Deployment-level secret scoping remains mandatory defense in depth. The production profile always marks `SBSESSION` Secure; the common configuration also makes it HttpOnly, `SameSite=Lax`, path `/`, with no Domain attribute.

B-03 supplies the email sender. A-10 reuses its `SB_MAIL_*` contract and adds production-safe TLS requirements plus finite connect/read/write timeouts. When delivery is enabled under `prod`, startup requires a valid sender, nonblank SMTP host/username/password, a valid port, authenticated SMTP, required STARTTLS, and an HTTPS frontend origin with no path/query/fragment. Local development may continue using an HTTP frontend URL outside `prod`. Configuration validation makes no SMTP connection and never logs credentials. The live pilot must set `SB_MAIL_ENABLED=true`; release verification must exercise delivery through the selected provider without recording message links or tokens.

The production profile disables Spring Boot's temporary generated-user auto-configuration so that no fallback password is written to production logs. This does not disable the application-owned database-backed `UserDetailsService`.

### Controlled migration job

Use the same reviewed artifact with the non-web `migration` profile. It also emits ECS JSON and disables the temporary generated-user auto-configuration. Supply both identities so Hibernate validates through the runtime login after Flyway migrates through the administrator login:

```sh
SPRING_PROFILES_ACTIVE=migration \
SB_DB_JDBC_URL='jdbc:postgresql://<host>:5432/postgres?sslmode=require' \
SB_DB_USER='servisimibul_app' \
SB_DB_PASSWORD='<runtime-secret>' \
SB_FLYWAY_ENABLED='true' \
SB_DB_MIGRATION_JDBC_URL='jdbc:postgresql://<host>:5432/postgres?sslmode=require' \
SB_DB_MIGRATION_USER='<migration-role>' \
SB_DB_MIGRATION_PASSWORD='<migration-secret>' \
java -jar target/servisimibul-backend-0.0.1-SNAPSHOT.jar \
  --spring.main.web-application-type=none
```

The command is a template: inject values through the release system's secret mechanism rather than literal shell arguments. Confirm the target hostname/database before execution. Never use `baselineOnMigrate`, `repair`, schema reset, or destructive SQL as an automatic fallback.

After the migration job exits successfully, remove its credentials from that job's environment. Check `flyway_schema_history` through a read-only administrative session and confirm every row for the release is successful before starting the new runtime.

## Health and readiness

Only the Actuator `health` endpoint is registered for remote access. The discovery page, environment, configuration-properties, Flyway, mappings, loggers, heap dump, and other diagnostic endpoints are unavailable. Health responses never show component names or details.

| Path | Meaning | Expected body when healthy |
|---|---|---|
| `/livez` | Process/application lifecycle only; it deliberately excludes PostgreSQL. | `{"status":"UP"}` |
| `/readyz` | Application readiness plus a runtime-credential PostgreSQL check. | `{"status":"UP"}` |
| `/actuator/health` | Aggregate internal health for operations; reports only status and the public probe-group names. | `{"groups":["liveness","readiness"],"status":"UP"}` |

Use `/livez` for liveness and `/readyz` for readiness. Removing PostgreSQL from liveness avoids restart loops during an external database outage; including it in readiness prevents traffic from reaching an instance that cannot serve database-backed requests.

Example post-deployment smoke checks:

```sh
curl --fail --silent --show-error https://<origin>/livez
curl --fail --silent --show-error https://<origin>/readyz
```

Health endpoints are intentionally anonymous because infrastructure probes cannot hold a user session. They return aggregate status only. Restrict them at the edge if the hosting platform supports internal-only probes, but do not expose more Actuator endpoints as a substitute.

The complete production-profile security context permits anonymous `GET /livez` and `GET /readyz`. Liveness uses only application lifecycle state; readiness includes the database indicator. A 401/403 from either path is a launch blocker.

Repository integration coverage uses a workflow-created PostgreSQL 17 database that is separate from the service container's default database. Before any migration or disruptive test action, the harness requires an explicit disposable flag and verifies both administrator and runtime JDBC connections against the expected database name, unique workflow marker, loopback server address, PostgreSQL major version, and distinct identities. The readiness test revokes `CONNECT` only for `servisimibul_app` on that marked database and terminates only connections matching that database, role, and the readiness test pool's application name. It never changes cluster-wide role login state or targets other connections. The real JDBC health contributor must make `/readyz` return status-only `503 DOWN` while `/livez` stays status-only `200 UP`; restoring database access must recover readiness within a bounded interval. The older synthetic DOWN-contributor test remains as a separate routing/serialization regression. Neither test uses shared Supabase.

## Executable deployment smoke check

From the repository root, run the provider-neutral read-only check with PowerShell 7 after the candidate deployment reports healthy:

```powershell
pwsh -NoProfile -File .\scripts\Test-BackendDeploymentSmoke.ps1 `
  -BaseUri https://<production-origin> `
  -TimeoutSeconds 10
```

The script requires an HTTPS origin, performs only GET requests, and verifies status-only `/livez` and `/readyz`, HSTS and the approved browser security headers, plus `GET /api/v1/provinces` as the stable anonymous read. Success exits `0` and prints `Backend deployment smoke checks passed.` Any mismatch, timeout, redirect, or non-success response exits nonzero with a path/header-level failure that omits bodies, cookies, and credentials.

An authenticated read-only `GET /api/v1/auth/me` is optional. Inject an already-issued test account's cookie value into `SB_SMOKE_SESSION_COOKIE` through the release system's secret mechanism before starting the process; do not put it on the command line or in a tracked file. The script never prints the value. Remove it immediately afterward. It does not log in, register, mutate data, run migrations, or test an administrator write.

`-AllowHttpForLocalTest` accepts only loopback HTTP and exists solely for the checked-in mock-server regression. It is not valid for staging or production. Run that regression directly with:

```powershell
pwsh -NoProfile -File .\scripts\Test-BackendDeploymentSmoke.Tests.ps1
```

## Logging and secret handling

The `prod` profile writes Elastic Common Schema JSON to stdout. The deployment platform, not the application, owns collection and retention. Hibernate bind-value logging and Spring MVC request-detail logging are explicitly disabled.

Application code must never log:

- passwords, password hashes, verification/reset tokens, cookies, CSRF values, or authorization headers;
- complete request/response bodies for authentication, profile, or admin endpoints;
- database/SMTP URLs containing credentials or secret environment values;
- private authentication email in public-search logs or student/home-address data, which the product must not collect.

Prefer a generated trace/correlation ID plus route template, result code, duration, and non-sensitive identity UUID when later API work adds request logging. Do not put free-form user input in structured log keys.

The `Secret scan` GitHub Actions workflow checks out complete history so Gitleaks can evaluate the commit range supplied by the GitHub event. For pull requests it scans the PR commit range; the successful initial PR #54 run reported four commits. A full-history checkout does **not** by itself prove that every historical repository commit was scanned. Checkout and scanner actions are pinned to full commit SHAs, permissions are read-only, and PR comments/artifact upload are disabled. No broad allow-list is configured; a suspected fixture false positive must be reviewed at the reported commit and suppressed only with the narrowest documented fingerprint or path. A passing scan reduces accidental-commit risk but cannot prove a credential was never exposed, recognize every proprietary format, or make a leaked credential safe. Treat any real finding as an incident: revoke/rotate first, then review history-removal options separately. If a repository-wide historical audit is required, run it as a separate reviewed process with an explicit all-refs/range configuration, record the exact tool version and scope, and define credential rotation and history-rewrite handling before acting on findings.

## Same-origin and trusted proxy policy

Production uses one browser origin for the frontend and `/api/v1`, so no application or Actuator CORS allow-list is configured. In particular, wildcard credentialed CORS is forbidden. If a future deployment requires a different origin, pause and review the exact HTTPS origins, credentials, CSRF behavior, proxy topology, and tests before adding CORS configuration.

Forwarded headers are ignored by default. If a platform requires them for HTTPS redirects or absolute links, enable only the platform-supported strategy and ensure the application port is reachable solely through trusted proxies; otherwise clients could spoof scheme or host information.

Rate-limit client identity independently uses the actual network peer and does not trust arbitrary `Forwarded` or `X-Forwarded-For`. Before changing that behavior, document the exact proxy hops and header-replacement guarantees and add spoofing tests. HSTS is emitted only when Spring recognizes a secure HTTPS request, so the chosen proxy topology must also be verified in staging.

## Single-instance rate limiter

The in-process limiter has bounded per-rule storage, expired-key cleanup, a protected repeated-identity tier, a small least-recently-used first-attempt probation tier, and constant-memory fixed-window overflow buckets. One-shot identity churn can evict only probationary single attempts; it cannot evict protected multi-attempt histories or poison overflow buckets, and a legitimate new identity on the same rule still receives a first attempt. Repeats are promoted when protected capacity exists. If protected capacity is full, repeats use the overflow tier, which conservatively records both their first and current attempts.

This bounded fallback retains explicit trade-offs. Evicting a probationary record can let that single attempt be forgotten, so authentication endpoints rely on their companion network-peer and token/account rules. Sustained distributed identities that each repeat can fill protected storage and overflow counters; unrelated repeats sharing a bucket can then be conservatively rejected, although new first attempts are not globally rejected. The process-secret fingerprint makes targeted bucket selection impractical but does not prevent untargeted botnet churn. Monitor active keys, probation evictions, saturation, and 429 rates together; a sustained rise requires abuse investigation and may trigger edge-level protection.

Limiter state resets on restart and is not shared. A platform that briefly overlaps old and new processes during deployment creates independent enforcement windows; verify that behavior before launch. If overlap weakens authentication protection beyond the accepted risk, require edge-level shared enforcement even while application traffic normally targets one instance. Future multi-instance work must compare managed edge/CDN controls, Redis, and PostgreSQL advisory/storage designs for cost, availability, security, operational complexity, and fail-open/fail-closed behavior; PostgreSQL is not added merely for hypothetical scaling.

## Tariff persistence contract

D033–D035 approve a backend-only persistent filesystem directory configured by `SB_TARIFF_STORAGE_DIR`; A-05 implements that contract. The production profile requires the variable, and deployment must mount the directory on a durable writable volume outside the packaged JAR. It must never point at the classpath, frontend, PostgreSQL fare tables, or Supabase Storage.

The implementation uses immutable version files and same-filesystem atomic replacement of `current.json`, rejects stale expected versions with 409, retains source/effective-date metadata, validates contiguous non-overlapping bands, and keeps history immutable. Rollback creates a new version from prior content. MVP supports one tariff-writer instance. The off-volume backup, restoration, and rollback procedure is in [`10_DATABASE_AND_BACKUP_OPERATIONS.md`](10_DATABASE_AND_BACKUP_OPERATIONS.md). Do not put storage paths in browser-visible configuration or treat application support alone as evidence that the volume is durable and recoverable.

## Deployment sequence

1. Confirm the release commit, artifact digest, target environment, active incidents, and database backup/restore readiness.
2. Run `verify` against disposable PostgreSQL 17. Never use shared Supabase as the test database.
3. Review the migration SQL and compatibility with the currently deployed application.
4. With explicit approval, run the one-shot migration job and verify `flyway_schema_history` plus expected grants/RLS.
5. Start the new runtime with `prod`, runtime credentials, Flyway disabled, and no migration secrets.
6. Wait for `/livez` and `/readyz`, then run `scripts/Test-BackendDeploymentSmoke.ps1`; supply a short-lived test session through the secret environment only when the authenticated read is required.
7. Shift traffic gradually when the platform supports it. Watch status transitions, error rate, latency, restart count, database connections, and ECS logs.
8. Remove superseded instances only after the observation window passes.

## Provider-neutral readiness and scaling

Railway, Render, and a managed VPS remain candidates; none is approved. Before selection, confirm low-traffic cost from a current quote, Java 21 artifact/container support, automatic restart, status-only liveness/readiness probes, secret handling, log/metric retention, persistent-volume durability and backups, outbound Supabase PostgreSQL/TLS support, connection management, custom-domain same-origin routing, deployment overlap/downtime behavior, and an explicit rollback mechanism. A VPS additionally requires named ownership for OS patching, firewall/TLS/reverse-proxy maintenance, monitoring, backup verification, and process supervision.

Launch monitoring must cover CPU, memory, request latency/error rate, restart count, readiness transitions, database pool active/pending/timeout behavior, rate-limit saturation/rejections, disk/volume health, and backup failures with actionable alerts. Capacity changes are triggered by measured sustained saturation, latency/error degradation, connection-pool pressure, deployment availability needs, or traffic growth; this document intentionally sets no unsupported numeric threshold.

Before adding instances: budget database connections across replicas; confirm Spring Session JDBC cleanup/index performance; move rate enforcement to an edge/shared design; replace the single-writer tariff filesystem or add a reviewed shared store/lock; coordinate Flyway as one pre-deploy job; ensure background jobs have leader/singleton execution; add load balancing, graceful draining, and rolling-deployment tests. Existing pilot operators also need a reviewed grandfathering/migration plan before changing `OPERATOR_APPROVAL_REQUIRED` from `false` to `true`, otherwise legitimate DRAFT/PENDING businesses could disappear from discovery.

## Rollback

Application rollback and database recovery are separate decisions:

1. Stop traffic expansion and preserve logs, release metadata, and the failing artifact.
2. If the schema remains backward compatible, redeploy the previous immutable application artifact and repeat `scripts/Test-BackendDeploymentSmoke.ps1` plus any release-specific read-only checks.
3. Do not run an automatic down migration, `Flyway repair`, table drop, or database restore.
4. If the previous application is not compatible with the migrated schema, keep traffic stopped or in maintenance mode and prepare a reviewed forward-fix migration.
5. Use [`10_DATABASE_AND_BACKUP_OPERATIONS.md`](10_DATABASE_AND_BACKUP_OPERATIONS.md) only after confirming the exact target, recovery point, data-loss window, and receiving fresh destructive-operation approval.
6. Record the incident, applied migration versions, final artifact digest, validation evidence, and follow-up actions.

Passing B-10 tests makes this a stronger deployable foundation, not authorization to call the product production-ready. Provider selection, proxy/overlap behavior, durable-volume and backup proof, staging limit measurements, monitoring/alerts, migration rehearsal, and release smoke checks remain deployment gates.
