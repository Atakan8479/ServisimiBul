# Windows frontend tooling

This setup supports frontend design and browser inspection in Codex Desktop. It does not add application dependencies or authorize application, database, or production changes. Follow `AGENTS.md` and the approved project documents.

## Shared files and personal setup

| Tool | Verified version | Shared through Git | Configure on each computer |
|---|---|---|---|
| Impeccable | Skill 4.6.0; engine 0.1.15 | `.agents/skills/impeccable/` and `.codex/hooks.json` | Platform engine and hook trust |
| 21st | CLI 1.18.0 | This guide only | Personal login, Windows user environment, user-level MCP entry |
| Playwright MCP | 0.0.83 | This guide only | Personal npm cache and user-level MCP entry |

Use Node.js 24 and npm. Verify `node --version`, `npm.cmd --version`, and `npx.cmd --version` first. Reuse an existing Node 24 installation; do not change another developer's global runtime automatically. Codex Desktop does not require a separate Codex CLI installation for manual MCP configuration.

Before an agent runs third-party installation commands, inspect official package sources and request approval. Stop for browser login, administrator privileges, security approval, or a required browser download. Never print authentication tokens or copy another developer's credentials.

## Impeccable after pulling this repository

The skill is already shared. If `.agents/skills/impeccable/SKILL.md` exists, do not run the project installer again. Its upstream license and third-party notices are included beside it; the supplied skill and launcher files are otherwise unmodified.

The platform binary under `scripts/bin/` is intentionally ignored by Git. With approval for its first-run download, the Windows launcher can obtain engine 0.1.15 from the official GitHub release and verify its SHA-256 sidecar:

```powershell
& .\.agents\skills\impeccable\scripts\impeccable.cmd engine-probe
```

Expected output: `impeccable-engine 0.1.15`. Network and a writable personal cache are required when no local engine is present. Do not disable antivirus or checksum verification if this fails.

Reload Codex if necessary and confirm `impeccable` appears in its skills. Open `/hooks` to review and trust this project's PostToolUse and Stop hooks yourself. They check UI edits and run a further design check when work stops. Trust is personal and may need renewal when the hook definition changes; never copy or edit another developer's trust records.

Use `$impeccable critique <surface>` in Codex chat for a review, or `$impeccable polish <surface>` for an approved refinement. `init` writes product context and is not part of this tooling-only setup.

## Personal 21st setup

Official documentation: <https://21st.dev/mcp>.

After source inspection and installation approval, run this in your own PowerShell session and complete the browser sign-in yourself:

```powershell
npx.cmd --yes @21st-dev/cli@1.18.0 login
```

The CLI saves personal authentication at `%USERPROFILE%\.config\21st\auth.json`. Keep it outside Git. The Codex configuration command prints a template rather than editing TOML:

```powershell
npx.cmd --yes @21st-dev/cli@1.18.0 init --client codex
```

Bind your saved login to your Windows user environment without displaying it. This refuses to overwrite a different existing credential:

```powershell
$storedAuth = Get-Content (Join-Path $env:USERPROFILE '.config/21st/auth.json') -Raw | ConvertFrom-Json
if ([string]::IsNullOrWhiteSpace($storedAuth.token)) { throw 'Complete 21st login first.' }
$existingToken = [Environment]::GetEnvironmentVariable('API_KEY_21ST', 'User')
if ($existingToken -and $existingToken -cne $storedAuth.token) { throw 'A different personal credential already exists.' }
[Environment]::SetEnvironmentVariable('API_KEY_21ST', $storedAuth.token, 'User')
$env:API_KEY_21ST = $storedAuth.token
```

If the Codex CLI is available, add the missing server with:

```powershell
codex.cmd mcp add 21st --url https://21st.dev/api/mcp --bearer-token-env-var API_KEY_21ST
```

Otherwise append this entry to the existing user-level `%CODEX_HOME%\config.toml`, or `%USERPROFILE%\.codex\config.toml` when `CODEX_HOME` is unset. Preserve every existing entry; inspect and reuse an existing `21st` entry rather than replacing it.

```toml
[mcp_servers.21st]
url = "https://21st.dev/api/mcp"
bearer_token_env_var = "API_KEY_21ST"
```

Fully quit and reopen Codex Desktop to inherit the user environment. If you sign in again with a different token, review and refresh this personal binding rather than silently overwriting it. Verify a read-only component search, such as `button` with a limit of three. Search metadata is free; code retrieval may consume your allowance. Do not fetch code, generate, publish, or install components as part of setup.

## Personal Playwright MCP setup

Official source: <https://github.com/microsoft/playwright-mcp>.

Inspect the pinned package and request installation approval before running:

```powershell
npx.cmd --yes @playwright/mcp@0.0.83 --version
```

This package pins Playwright `1.64.0-alpha-1790635538000`. The verified setup uses an already-installed Microsoft Edge browser, not an additional browser download or your everyday browser profile.

If the Codex CLI is available, register the missing server with your own Node 24 launcher path:

```powershell
$npxPath = (Get-Command npx.cmd -ErrorAction Stop).Source
$outputDirectory = Join-Path $env:USERPROFILE 'AppData/Local/ServisimiBul/playwright-mcp'
codex.cmd mcp add playwright -- cmd.exe /d /c $npxPath --yes @playwright/mcp@0.0.83 --browser msedge --isolated --headless --output-dir $outputDirectory
```

If that computer has no Codex CLI, configure the equivalent user-level stdio MCP entry in Codex: command `cmd.exe`; arguments `/d`, `/c`, the absolute path returned by `Get-Command npx.cmd`, `--yes`, `@playwright/mcp@0.0.83`, `--browser`, `msedge`, `--isolated`, `--headless`, `--output-dir`, and the personal output directory above. Have Codex preserve existing TOML entries and quote Windows paths correctly. Do not commit this machine-specific configuration or install a separate CLI just for this step.

Reload Codex and verify that Playwright tools are available. Ask it to open a public demo, inspect its accessibility/DOM content, capture a screenshot outside the repository, and close the browser. Verify actual page content rather than assuming a fixed heading. Do not use authenticated private sites, production data, or saved browser storage for this setup check.

Headless mode normally shows no browser window. Isolated sessions do not reuse your normal browser login and lose their browser storage when closed. If Edge is missing or a browser download is needed, stop and request approval.

## Verification and updates

- Confirm Impeccable is visible, hook trust is saved or explicitly pending, 21st can search, and Playwright can open and inspect a public site.
- Preserve existing MCP settings. Compare structured values with sorted object keys; Codex JSON output may reorder keys between reads.
- Keep personal tokens, user-level configuration, generated browser outputs, and platform binaries outside the commit. Never put `API_KEY_21ST` into a frontend environment file.
- Confirm application source and application dependency/lockfile diffs remain empty for tooling-only work. Do not run application tests against shared Supabase.
- Review upstream changes before updating these pins or the shared skill. A hook-definition update can require each developer to trust it again.

Local verification evidence is recorded in `06_PROGRESS.md`. These are developer tools; browser smoke checks do not replace application regression tests or a full accessibility audit.
