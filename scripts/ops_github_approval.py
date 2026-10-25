"""Read-only GitHub PR review gate. Never authorizes database writes by itself."""
import json
import os
import re
import sys
from urllib.request import Request, urlopen

OWNER = "Atakan8479"
REPO = "ServisimiBul"
PROJECT_REF = "whftdzfbvpchmghttjkg"
TRUSTED = {"OWNER", "MEMBER", "COLLABORATOR"}
# Approval is audit evidence only; never an automatic production authorization.

def approved_reviewer(pr, reviews, expected_sha, actor):
    if pr.get("state") != "open" or pr.get("draft") is not False:
        raise ValueError("PR is not open and ready for independent review")
    if pr.get("base", {}).get("ref") != "main":
        raise ValueError("Approval target must be main")
    if pr.get("head", {}).get("sha") != expected_sha:
        raise ValueError("Approval is not bound to the exact reviewed head commit")
    author = pr.get("user", {}).get("login", "").casefold()
    initiating_actor = actor.casefold()
    if not author or not initiating_actor:
        raise ValueError("PR author and workflow initiator are required")
    latest = {}
    for record in sorted(reviews, key=lambda item: (item.get("submitted_at") or "", item.get("id") or 0)):
        login = (record.get("user") or {}).get("login", "").casefold()
        if login:
            latest[login] = record
    # A review approval must apply to the exact immutable SHA. A later
    # disapproval, dismissal, or unknown state supersedes earlier approvals.
    eligible = []
    for login, item in latest.items():
        if login in {author, initiating_actor}:
            continue
        if item.get("state") != "APPROVED" or item.get("commit_id") != expected_sha:
            continue
        if item.get("author_association") not in TRUSTED:
            continue
        eligible.append(login)
    if not eligible:
        raise ValueError("No independent, current-head collaborator approval found")
    return sorted(eligible)[0]

def fetch_json(path, token):
    req = Request("https://api.github.com/" + path,
        headers={"Authorization": "Bearer " + token,
                 "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28"})
    with urlopen(req, timeout=12) as response:
        return json.load(response)

def main():
    if len(sys.argv) != 4:
        raise ValueError("Usage: ops_github_approval.py <pr-number> <pr-head-sha> <project-ref>")
    number, sha, project = sys.argv[1:]
    if not number.isdecimal() or not 1 <= int(number) <= 999999:
        raise ValueError("Invalid PR number")
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        raise ValueError("Expected immutable 40-character PR head SHA")
    if project != PROJECT_REF:
        raise ValueError("Project reference is not the independently reviewed target")
    if (os.getenv("GITHUB_ACTIONS") != "true" or
            os.getenv("GITHUB_EVENT_NAME") != "workflow_dispatch" or
            os.getenv("GITHUB_REPOSITORY") != OWNER + "/" + REPO or
            os.getenv("GITHUB_REF") != "refs/heads/main"):
        raise ValueError("Approval check must run in the reviewed main-branch GitHub workflow")
    token = os.getenv("GITHUB_TOKEN")
    if not token:
        raise ValueError("Missing ephemeral Actions token")
    actor = os.getenv("GITHUB_ACTOR", "")
    pr = fetch_json(f"repos/{OWNER}/{REPO}/pulls/{int(number)}", token)
    reviews = []
    for page in range(1, 11):
        batch = fetch_json(f"repos/{OWNER}/{REPO}/pulls/{int(number)}/reviews?per_page=100&page={page}", token)
        if not isinstance(batch, list):
            raise ValueError("Review API response invalid")
        reviews.extend(batch)
        if len(batch) < 100:
            break
    else:
        raise ValueError("Review list exceeds fixed upper bound; manual audit required")
    reviewer = approved_reviewer(pr, reviews, sha, actor)
    print(f"Independent GitHub review check PASS: PR #{number}, head {sha[:12]}, reviewer {reviewer}.")
    print("ADVISORY ONLY. No production approval, environment protection verification or database write has occurred.")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        # Never emit HTTP response bodies or tokens in CI.
        print("Approval verification denied: " + str(exc)[:220], file=sys.stderr)
        sys.exit(1)
