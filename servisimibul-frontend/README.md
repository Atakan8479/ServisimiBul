# ServisimiBul frontend

Node.js 24 and npm are required. The browser always calls the same-origin `/api/v1` path; during local development Vite proxies `/api` to Spring Boot.

```powershell
npm ci
npm run dev
```

Copy `.env.example` to an ignored `.env.local` only when the backend does not run at `http://localhost:8080`. `BACKEND_PROXY_TARGET` is read by Vite's local server and is not exposed to browser code. Never put database credentials, session secrets, admin credentials, or Supabase service keys in frontend environment files.

The public surface provides anonymous operator discovery and an anonymous demand board with school/neighborhood filtering, aggregate demand details, and paginated public comments. Parents register at `/parent/register` and sign in at `/parent/login`; both routes remain separate from operator authentication. Creating a demand or joining, editing, withdrawing, or reactivating support requires a `PARENT` session and CSRF protection. The explicit controlled-pilot configuration in `docs/03_SECURITY_AND_API.md` permits enabled parents to sign in without falsely marking their email as verified. New-demand flow checks existing operators first and never silently joins a parent when the canonical demand already exists. Supporting parents and eligible operators can add comments to open demands, while comment ownership and publication-safe identity remain backend-authoritative.

The operator workspace provides registration, email verification, login, profile/application management, school/general-coverage, vehicle, and offering screens. The admin workspace provides application review, pilot-school management, and official-tariff editing. Frontend route guards and selected identifiers are usability features only; Spring Security, ownership checks, and coverage validation remain authoritative.

The B-11 Playwright suite uses deterministic mocked same-origin API responses and synthetic identities. It never needs backend credentials or shared Supabase. Local Windows runs use installed Microsoft Edge; CI installs disposable Playwright Chromium. See `docs/11_E2E_ACCESSIBILITY_VALIDATION.md` for the evidence boundary and journey matrix.

Before opening a pull request, run:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```
