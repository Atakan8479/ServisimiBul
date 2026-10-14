# Backend deployment and observability runbook

This runbook covers the Spring Boot backend artifact. It does not authorize a production release or a database change. Every migration still requires the reviewed migration PR, current-state verification, a confirmed target, and explicit human approval required by `AGENTS.md`.

## Release contract

- Build and run with Java 21-compatible bytecode. CI uses Java 21; developer Maven may run on JDK 25.
- Serve the SPA and `/api/v1` from one HTTPS origin in production. Application CORS and Actuator CORS remain disabled.
- Terminate TLS at a trusted reverse proxy or load balancer. `SB_FORWARD_HEADERS_STRATEGY` defaults to `none`; change it only after the deployment platform's trusted-proxy behavior is reviewed.
- Store secrets in the deployment platform's secret manager. Do not put secret values in Git, image layers, command history, health responses, or logs.
- Run Flyway as a one-shot release step with migration credentials. Run the application with only the restricted `servisimibul_app` credentials and Flyway disabled.
- Deploy immutable JARs. Do not write tariff data or other persistent state inside an expanded or packaged application artifact.

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
| `SB_FLYWAY_ENABLED=false` | yes | Prevents normal instances from applying migrations. |
| `SB_MAIL_ENABLED=true` | yes | Enables the B-03 verification/recovery mail sender after the remaining mail settings are configured. |
| `SB_MAIL_HOST` | yes | SMTP host. |
| `SB_MAIL_PORT` | no | Defaults to `587`. |
| `SB_MAIL_USERNAME` | yes, secret | SMTP login. |
| `SB_MAIL_PASSWORD` | yes, secret | SMTP password. |
| `SB_MAIL_FROM` | yes | Verified sender address. |
| `SB_FRONTEND_BASE_URL` | yes | HTTPS frontend origin used to build verification/reset links. |
| `SB_MAIL_SMTP_AUTH` | no | Defaults to `true`. |
| `SB_MAIL_STARTTLS` | no | Defaults to `true`. |
| `SB_MAIL_STARTTLS_REQUIRED` | no | Defaults to `true` in the production profile. |
| `SB_MAIL_CONNECTION_TIMEOUT_MS` | no | SMTP connect timeout; defaults to `5000`. |
| `SB_MAIL_READ_TIMEOUT_MS` | no | SMTP read timeout; defaults to `5000`. |
| `SB_MAIL_WRITE_TIMEOUT_MS` | no | SMTP write timeout; defaults to `5000`. |
| `SB_SERVER_PORT` | no | Defaults to `8080`. |
| `SB_LOG_LEVEL` | no | Root log level, default `INFO`. Do not use `DEBUG` or `TRACE` routinely in production. |
| `SB_SHUTDOWN_TIMEOUT` | no | Graceful shutdown window, default `30s`. |
| `SB_FORWARD_HEADERS_STRATEGY` | no | Defaults to `none`; set only for a reviewed trusted-proxy topology. |

Do not provide `SB_DB_MIGRATION_USER` or `SB_DB_MIGRATION_PASSWORD` to the normal runtime. The production profile always marks `SBSESSION` Secure; the common configuration also makes it HttpOnly, `SameSite=Lax`, path `/`, with no Domain attribute.

B-03 supplies the email sender. A-10 reuses its `SB_MAIL_*` contract and adds production-safe TLS requirements plus finite connect/read/write timeouts; it does not send test email or log SMTP credentials.

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

## Logging and secret handling

The `prod` profile writes Elastic Common Schema JSON to stdout. The deployment platform, not the application, owns collection and retention. Hibernate bind-value logging and Spring MVC request-detail logging are explicitly disabled.

Application code must never log:

- passwords, password hashes, verification/reset tokens, cookies, CSRF values, or authorization headers;
- complete request/response bodies for authentication, profile, or admin endpoints;
- database/SMTP URLs containing credentials or secret environment values;
- private authentication email in public-search logs or student/home-address data, which the product must not collect.

Prefer a generated trace/correlation ID plus route template, result code, duration, and non-sensitive identity UUID when later API work adds request logging. Do not put free-form user input in structured log keys.

## Same-origin and trusted proxy policy

Production uses one browser origin for the frontend and `/api/v1`, so no application or Actuator CORS allow-list is configured. In particular, wildcard credentialed CORS is forbidden. If a future deployment requires a different origin, pause and review the exact HTTPS origins, credentials, CSRF behavior, proxy topology, and tests before adding CORS configuration.

Forwarded headers are ignored by default. If a platform requires them for HTTPS redirects or absolute links, enable only the platform-supported strategy and ensure the application port is reachable solely through trusted proxies; otherwise clients could spoof scheme or host information.

## Tariff persistence contract

D033–D035 approve a backend-only persistent filesystem directory configured by `SB_TARIFF_STORAGE_DIR`; the tariff feature itself is not implemented yet. The deployment must mount that directory on a durable writable volume outside the packaged JAR. It must never point at the classpath, frontend, PostgreSQL fare tables, or Supabase Storage.

Implementation must use immutable version files and same-filesystem atomic replacement of `current.json`, reject stale expected versions with 409, retain source/effective-date metadata, validate contiguous non-overlapping bands, and keep history immutable. Rollback creates a new version from prior content. MVP supports one tariff-writer instance; A-09 still owns off-volume backup and verified restoration. Do not put storage paths in browser-visible configuration or treat the approved contract as evidence that the tariff feature is already deployable.

## Deployment sequence

1. Confirm the release commit, artifact digest, target environment, active incidents, and database backup/restore readiness.
2. Run `verify` against disposable PostgreSQL 17. Never use shared Supabase as the test database.
3. Review the migration SQL and compatibility with the currently deployed application.
4. With explicit approval, run the one-shot migration job and verify `flyway_schema_history` plus expected grants/RLS.
5. Start the new runtime with `prod`, runtime credentials, Flyway disabled, and no migration secrets.
6. Wait for `/livez` and `/readyz`, then perform an authenticated and public smoke test appropriate to the released features.
7. Shift traffic gradually when the platform supports it. Watch status transitions, error rate, latency, restart count, database connections, and ECS logs.
8. Remove superseded instances only after the observation window passes.

## Rollback

Application rollback and database recovery are separate decisions:

1. Stop traffic expansion and preserve logs, release metadata, and the failing artifact.
2. If the schema remains backward compatible, redeploy the previous immutable application artifact and repeat liveness/readiness plus feature smoke checks.
3. Do not run an automatic down migration, `Flyway repair`, table drop, or database restore.
4. If the previous application is not compatible with the migrated schema, keep traffic stopped or in maintenance mode and prepare a reviewed forward-fix migration.
5. Use the backup/restore procedure from A-09 only after confirming the exact target, recovery point, data-loss window, and receiving fresh destructive-operation approval.
6. Record the incident, applied migration versions, final artifact digest, validation evidence, and follow-up actions.

Until A-08, A-09, B-10, the tariff-store implementation, and the relevant feature work are complete, this runbook is a deployable foundation rather than authorization to call the whole product production-ready.
