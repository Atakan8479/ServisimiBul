# APP-14 — Conditional cookie and commercial-message preferences

Issue: [#221](https://github.com/Atakan8479/ServisimiBul/issues/221). Status: **CONDITIONAL — NOT ACTIVATED.** This record is not legal advice, legal approval, a cookie notice, a marketing permission, or an İYS filing.

## Current decision gate

APP-14 has no approved implementation trigger. The verified repository boundary remains:

- one first-party `SBSESSION` cookie for the server-side authenticated session and CSRF protection;
- one tab-scoped `sessionStorage` role hint used only for navigation;
- no analytics, advertising, fingerprinting, third-party browser tracker, consent-management vendor, or optional cookie;
- no marketing email, SMS, call, or push path; and
- only account/security email operations in `AuthEmailSender`.

Consequently, no cookie banner, preference center, marketing-consent record, İYS integration, or production feature flag is implemented by APP-14. Adding controls with no optional processing behind them would present a false choice and collect unnecessary preference data.

## Activation contract

Implementation may begin only after both conditions are met:

1. An approved product change introduces a concrete nonessential browser-storage/tracking purpose or a commercial electronic-message channel.
2. The applicable LEG-09 C1–C4 and LEG-10 T3 decisions are reviewed and recorded, including the lawful basis, notice, prior blocking or permission rules, refusal and withdrawal behavior, evidence, retention, vendors, accessibility, and responsive acceptance criteria.

Any implementation must be limited to those approved requirements. A new dependency, remote script or embed, cookie, `localStorage`, IndexedDB, service worker, browser push subscription, changed storage purpose, or promotional message is a reassessment trigger before activation.

## Safe work allowed now

Only repository inventory and fail-closed regression checks are in scope while the gate is closed. They may detect a trigger, but must not infer legal applicability, enable tracking, send messages, create consent records, or touch a live environment.

Issue #221 remains open for an owner decision: close it as not planned while the current boundary holds, or reactivate it after the activation contract is satisfied. Merging this record does not complete or approve APP-14.

## Evidence boundary

This inventory was reconfirmed against the feature branch on 2026-11-08 from production source and dependency manifests. Repository inspection cannot prove that an unrecorded deployment intermediary injects no cookie or script; the exact release deployment must be checked if APP-14 is activated.

Source records: `docs/30_COOKIE_TRACKING_AND_MARKETING_CONSENT.md` (LEG-09) and `docs/27_VERBIS_ETBIS_IYS_APPLICABILITY.md` (LEG-10).
