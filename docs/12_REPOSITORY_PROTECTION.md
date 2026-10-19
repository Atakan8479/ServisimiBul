# Repository protection and two-developer workflow

## Verified baseline — 2026-10-19

The repository is public, its default branch is `main`, and the two developers are `Atakan8479` (repository administrator) and `LePqrta` (write collaborator). Read-only GitHub API inspection at commit `0ffadfe6c03a902cf4abaf9203759b9f69e76245` found:

- `main` was not protected;
- no repository rulesets existed;
- force pushes and deletion were not blocked by a repository rule;
- merged PRs #60, #62, #63, and #64 had successful applicable workflows but no submitted GitHub review;
- Backend and Frontend both emitted the check-run name `test`, so they could not be selected as unambiguous independent required checks.

GitHub documents [protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) and [repository rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) as available to public repositories on GitHub Free. J-04 requires no paid plan or subscription.

## Required check contract

Every pull request targeting `main` must run these unique GitHub Actions check names:

| Required check | Workflow                            | Scope                                                                                                                       |
| -------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Backend`      | `.github/workflows/backend.yml`     | Java 21 build/tests, disposable PostgreSQL 17 migrations and security checks, deployment smoke test, migration verification |
| `Frontend`     | `.github/workflows/frontend.yml`    | Node.js 24 formatting, lint, strict type-check, unit tests, build, and Playwright checks                                    |
| `Secret scan`  | `.github/workflows/secret-scan.yml` | Gitleaks scan of the pull-request commit range                                                                              |

Backend and Frontend intentionally run on every pull request, including documentation-only changes. GitHub's [required-check troubleshooting guide](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks) explains that a path-filtered required workflow remains pending when its filters do not match, which would prevent a compliant merge. Push-to-`main` path filters remain an optimization after merge.

Third-party actions are pinned to full commit SHAs. Updating an action requires a reviewed pull request that records the upstream release represented by the new SHA.

## Verified PR #73 CI and local E2E troubleshooting — 2026-10-19

The PR head `c4c6a533bb1755d75ac9d42aa6ca078e25401aa5` completed all three GitHub Actions jobs successfully: Backend `39224801159`, Frontend `39224800963`, and Secret scan `39224801015`. The Frontend job successfully ran `npm run test:e2e` after installing Chromium. This verifies CI execution of the named checks on that commit; any later commit to the PR needs its own successful checks. Local Windows Playwright attempts previously stalled while waiting for Vite, but that did not reproduce in CI.

If Playwright stalls on a developer's Windows machine, diagnose locally without changing production behavior:

1. Confirm Node.js 24 and run `npm ci` from `servisimibul-frontend`.
2. Start `npm run dev -- --host 127.0.0.1 --port 4173` in a separate terminal and inspect the actual startup error, if any.
3. Check that `http://127.0.0.1:4173` is reachable before executing `npm run test:e2e` in another terminal.
4. Check for a port collision or endpoint blocked by local security software; collect Vite/Playwright stdout and stderr. Do not claim a passing local E2E run without its output.
5. Recheck the latest PR-head GitHub Actions results before merge. Do not weaken or skip the mandatory Frontend CI check to work around a local-only failure.

## Target `main` ruleset

Create one active branch ruleset targeting the repository default branch with no bypass actors:

- require a pull request before merging;
- require one approving review;
- dismiss stale approvals when new commits are pushed;
- require approval of the most recent reviewable push;
- require a Code Owner review using `.github/CODEOWNERS`;
- require all review conversations to be resolved;
- require `Backend`, `Frontend`, and `Secret scan` to pass and require the branch to be current with `main`;
- block force pushes;
- block branch deletion.

Do not enable a paid feature, merge queue, required deployment, signed-commit requirement, or provider-specific integration as part of J-04.

### Owner-admin activation steps

After this pull request produces successful checks with the three unique names:

1. Open **Settings → Rules → Rulesets → New ruleset → New branch ruleset**.
2. Name it `Protect main`; leave enforcement **Active** and the bypass list empty.
3. Target **default branch** only.
4. Enable **Restrict deletions** and **Block force pushes**.
5. Enable **Require a pull request before merging** with exactly one required approval, stale-approval dismissal, Code Owner review, and approval of the most recent reviewable push.
6. Enable required conversation resolution.
7. Enable required status checks, select `Backend`, `Frontend`, and `Secret scan`, and require branches to be up to date before merging.
8. Review the rule summary and create the ruleset. Do not select any paid or unrelated rule.
9. Read `GET /repos/Atakan8479/ServisimiBul/rulesets` and the returned ruleset detail. Confirm `active` enforcement, the default-branch target, an empty bypass list, the three exact status-check contexts, one required approval, Code Owner/stale/last-push review requirements, conversation resolution, deletion restriction, and non-fast-forward protection.

The ruleset is not considered enabled until a post-write GitHub API read confirms its active enforcement, target, bypass list, pull-request rule, required checks, deletion rule, and non-fast-forward rule. Record that evidence in `docs/06_PROGRESS.md`; never infer protection from this document alone.

## Two-developer review and merge workflow

1. Refresh local `main`, then create one `codex/<task>` branch for the approved task.
2. Keep the diff within the issue scope and preserve unrelated working-tree changes.
3. Run the relevant local checks and record only commands that actually completed.
4. Push the task branch and open one focused pull request linked to its issue.
5. The developer who did not author the latest reviewable changes reviews the PR. The author cannot satisfy the required approval.
6. Address review comments on the same branch. A new reviewable push dismisses the earlier approval and requires the other developer to approve again.
7. Merge only after `Backend`, `Frontend`, and `Secret scan` pass, the branch is current, all conversations are resolved, and the required review is present.
8. Never push directly to `main`. Never force-push or delete `main`. Emergency changes follow the same pull-request path; changing or bypassing the rules requires an explicit, documented owner decision.

The repository administrator may change GitHub settings, but the J-04 policy deliberately configures no bypass actor. If GitHub reports that a requested rule is unavailable, leave protection fail-closed where possible, record the exact platform limitation, and request a human decision instead of purchasing an upgrade.
