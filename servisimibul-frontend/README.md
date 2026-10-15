# ServisimiBul frontend

Node.js 24 and npm are required. The browser always calls the same-origin `/api/v1` path; during local development Vite proxies `/api` to Spring Boot.

```powershell
npm ci
npm run dev
```

Copy `.env.example` to an ignored `.env.local` only when the backend does not run at `http://localhost:8080`. `BACKEND_PROXY_TARGET` is read by Vite's local server and is not exposed to browser code. Never put database credentials, session secrets, admin credentials, or Supabase service keys in frontend environment files.

The operator workspace provides registration, email verification, login, profile/application management, and school/general-coverage screens. The admin area remains a route shell. Frontend route guards and selected identifiers are usability features only; Spring Security, ownership checks, and coverage validation remain authoritative.

Before opening a pull request, run:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```
