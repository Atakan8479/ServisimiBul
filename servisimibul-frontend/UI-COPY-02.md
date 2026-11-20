# UI-COPY-02: first API copy slice

Scope: issue #269 API-01, API-02 and API-04 only.

Verified against main `789b889` on 2026-11-20. All three gaps remained:
`ApiExceptionHandler` emits `RATE_LIMITED`, the frontend mapped only
`RATE_LIMIT_EXCEEDED`, unknown details passed through unchanged, and
`RouteErrorPage` rendered the backend title. The only open PR was #304;
this branch does not include or modify it.

The frontend now maps both rate-limit codes, uses the existing Turkish
fallback for unknown/missing codes (including object-prototype names), and
uses a fixed Turkish API route-error heading. Codes, statuses, trace IDs,
field errors, session handling and navigation remain unchanged. Retry-After
stays on the HTTP response as before; no retry mechanism was added.

Regression coverage checks known/unknown codes, HTTP 429 metadata and retry
headers, route headings/details and existing session-expiry behavior.
Existing unit/browser assertions now expect the safe fallback instead of
raw fixture details; their focus, retry and state-preservation checks remain.

Validation: focused API/router suite 39/39; lint, typecheck, build and
line-ending-normalized Prettier passed. Plain local format:check reports
Windows CRLF checkout differences; Linux CI runs the standard check.
Full regression and browser/CI results are recorded in the PR.

All other issue #269 items, including field-error localization (API-03),
additional domain mappings (API-05) and the broader copy audit, remain deferred.
Unknown codes intentionally receive generic guidance until explicitly mapped.
