# LEG-10 — VERBIS, ETBIS, and İYS registration applicability (decision record)

Issue: [#203](https://github.com/Atakan8479/ServisimiBul/issues/203). Depends on LEG-01 (`docs/18_LEGAL_ROLE_AND_DATA_CONTROLLER.md`, [#194](https://github.com/Atakan8479/ServisimiBul/issues/194), closed), LEG-02 (`docs/19_PERSONAL_DATA_PROCESSING_MAP.md`, [#195](https://github.com/Atakan8479/ServisimiBul/issues/195), closed), and LEG-09 ([#202](https://github.com/Atakan8479/ServisimiBul/issues/202), **still open, no technical record exists**). Status: **DRAFT — NOT APPROVED, NOT LAWYER-REVIEWED.**

This document is not legal advice, not a registration filing, not an exemption claim, and not a compliance claim. It records verified product and business facts, names the official registries and their administering authorities, and sets out the applicability questions that only the owner and qualified Turkish counsel can answer. **It registers nothing and claims no exemption.** It uses the same status categories as the LEG-01 record: **A** verified fact, **B** PROPOSED, **C** pending legal decision, **D** approved decision (`docs/01_DECISIONS.md` only). It adds no approved decision.

LEG-10 is outside the LEG-01 to LEG-07 tracker (`docs/25_LEGAL_APPROVAL_TRACKER.md`), same as LEG-08 and LEG-09. It keeps its own issue and this record.

## 1. Decision summary

| Regime | Applies to current MVP? | Owner | Reviewer | Evidence | Date |
|---|---|---|---|---|---|
| VERBIS (Veri Sorumluları Sicili — KVKK data controllers' registry) | `[PENDING: counsel]` (T1) | `[PENDING]` — PROPOSED: repository owner `Atakan8479` | `[PENDING]` — qualified Turkish counsel, not yet identified | `[PENDING: e.g. a dated written opinion reference; do not commit privileged content]` | `[PENDING]` |
| ETBIS (E-Ticaret Bilgi Sistemi — electronic commerce information system) | `[PENDING: counsel]` (T2) | same as above | same as above | `[PENDING]` | `[PENDING]` |
| İYS (İleti Yönetim Sistemi — commercial message management system) | `[PENDING: counsel]` (T3) | same as above | same as above | `[PENDING]` | `[PENDING]` |

No row may be marked "does not apply" on the strength of this record alone. An exemption is a legal conclusion that still requires counsel's written opinion against the specific criteria in section 3, not an inference from the absence of a feature.

## 2. Official authorities and sources (verified, not interpreted)

| Regime | Governing instrument | Administering authority | What it registers |
|---|---|---|---|
| VERBIS | Law No. 6698 (KVKK), Art. 16; Board decisions on registration obligation exemptions | Kişisel Verileri Koruma Kurumu (KVKK Authority) | Data controllers who meet the Board's registration criteria, before processing |
| ETBIS | Law No. 6563 (Electronic Commerce Law) and its secondary regulation | T.C. Ticaret Bakanlığı (Ministry of Trade) | E-commerce service providers (ESHS) and intermediary service providers (AHS) engaged in electronic commerce |
| İYS | Law No. 6563 and the Regulation on Commercial Communication and Commercial Electronic Messages | T.C. Ticaret Bakanlığı (Ministry of Trade) | Senders of commercial electronic messages (email/SMS/call) to recipients, and the consent records behind them |

This section only names the regime and its authority. It does not state the registration thresholds, exemption categories, or procedure; those are the applicability criteria in section 3, which this record does not resolve.

## 3. Applicability criteria and what they require from the business

Each regime's registration obligation turns on business facts that are either not yet decided (see LEG-01, section 1) or not recorded anywhere in this repository. This record does not estimate or assume any of them.

### T1 — VERBIS

- **Criteria that drive the obligation:** the data controller's legal form (natural person vs. legal entity), annual employee count, annual balance sheet total, whether personal-data processing is the controller's main activity, and whether special-category data or data of other controllers is processed on their behalf — thresholds and exemption categories are set by KVKK Board decisions, not estimated here.
- **Missing business metrics (not in this repository):** identity and legal form of the data controller (LEG-01 L1, `[PENDING]`), employee count, annual balance sheet/turnover. None of these exist in the codebase; they are organizational facts only the owner can supply.
- **Verified product facts bearing on it:** the platform processes personal data of parents, operators, and site visitors (LEG-02 inventory, `docs/19_PERSONAL_DATA_PROCESSING_MAP.md`); no special-category data is collected by design (D015; LEG-02 section 5; LEG-08 section 2.4).
- **Dependency:** blocked on LEG-01 L1 (controller identity/legal form) and on owner-supplied employee/turnover figures that do not exist in this repository.

### T2 — ETBIS

- **Criteria that drive the obligation:** conducting "elektronik ticaret" under Law 6563 — generally, offering goods/services for sale, taking orders, or operating as an intermediary service provider (aracı hizmet sağlayıcı) connecting buyers and sellers electronically, with revenue or commission.
- **Verified product facts:** no feature to book, reserve, order, or pay exists, and no payment code exists in the repository (LEG-01 section 2; confirmed again by this record: no `payment`/`Payment`/`invoice`/`Invoice` symbol anywhere in `servisimibul-backend/src/main/java`). No commission, listing fee, or featured placement is implemented (D variants in LEG-01 section 5; LEG-01 L6 "is the pilot free in every respect" is `[PENDING]`).
- **Missing business metrics:** whether any future commission, fee, or paid-placement model is planned, and when (LEG-01 L6, `[PENDING]`); the ETBIS applicability table's own trigger list in LEG-01 section 4 lists the same reassessment triggers.
- **Dependency:** blocked on LEG-01 L6 and L7 (owner's revenue-model statement and counsel's regime opinion), neither of which is recorded.

### T3 — İYS

- **Criteria that drive the obligation:** sending commercial electronic messages (marketing email, SMS, or calls) to recipients; the registration and consent-management duty attaches to the sender of such messages, not to transactional/service messages.
- **Verified product facts:** `application-prod.properties` enables SMTP only for account verification and password-recovery emails (`servisimibul.email.enabled`, `SB_MAIL_*`); no marketing-email or SMS code path exists in the repository, and `app.auth.email-change.enabled=false` keeps even the email-change notice disabled in production. No analytics, advertising, or tracking script is loaded (`servisimibul-frontend/index.html`, `package.json` — reconfirmed by this record, no hits for `analytics`/`gtag`/`cookie`). These are the same facts LEG-01 section 2 records for the free pilot.
- **Missing decision, not merely missing data:** LEG-09 ([#202](https://github.com/Atakan8479/ServisimiBul/issues/202)) is the record meant to inventory cookies/trackers and decide whether any marketing consent is needed, and LEG-01 section 4 explicitly points İYS assessment to LEG-09 and this issue. **LEG-09 is still an open issue with no merged technical record and no file under `docs/`.** This record cannot complete T3 because the upstream analysis it depends on does not exist yet.
- **Dependency:** blocked on LEG-09 being completed first (see section 5), then on counsel's opinion applying its findings plus LEG-01 L7.

## 4. Reconciliation with AUDIT-F4 (#166)

[#166](https://github.com/Atakan8479/ServisimiBul/issues/166) scoped a KVKK privacy notice, retention, and rights-request process. It did not mention VERBIS, ETBIS, or İYS, and its closure on 2026-10-31 with no comments produced no registration analysis, exemption claim, or decision record for any of the three regimes (same closure pattern LEG-01 section 6 already documented for the KVKK-specific elements). **#166's closure is not evidence that VERBIS, ETBIS, or İYS applicability has been assessed or that an exemption exists.** This record is the first repository artifact to address all three regimes together.

## 5. Unresolved dependencies and risks

1. **LEG-09 (#202) is an unmet dependency, not a completed input.** The issue is open, unassigned to a merged PR, and has no `docs/` record. T3 (İYS) cannot be resolved until LEG-09's cookie/tracker inventory and marketing-consent decision exist. Treat T3 as blocked, not as "not applicable."
2. **LEG-01 L1, L6, L7 remain `[PENDING]`.** T1 and T2 both resolve to counsel opinions that need the controller's legal form and the owner's revenue-model statement, neither of which this repository or any LEG record has recorded.
3. **No company-level metrics exist in the repository.** Employee count and annual balance sheet/turnover (VERBIS thresholds) are organizational facts outside source control; they must be supplied by the owner directly to counsel, not inferred or invented here.
4. **Reassessment trigger.** Any of the following reopens this record: a company/legal entity is formed or changes form, any paid feature, commission, listing fee, or advertising is added, marketing email/SMS or İYS-covered messaging is introduced, employee count or turnover crosses a KVKK Board threshold, or LEG-01 L1/L6/L7 or LEG-09 is decided.
5. **Do not treat a future "does not apply" conclusion as exempting the product from other KVKK obligations** (issue #203 acceptance criterion), including LEG-02 through LEG-08's separate, still-pending items.
6. **A GitHub issue is not legal approval.** Completing this documentation record does not authorize registration, non-registration, or any production messaging behavior. Activation still needs the release gates in `docs/25_LEGAL_APPROVAL_TRACKER.md` section 5 and LEG-01 section 9's L8 decision.

## 6. Decision and approval workflow

1. **Owner evidence first.** The owner supplies the controller's legal form (or confirms it is still undetermined, see LEG-01 L1), employee count, annual balance sheet/turnover, and any revenue-model statement (LEG-01 L6).
2. **Complete LEG-09** so its cookie/tracker inventory and marketing-consent decision exist as a merged technical record under `docs/`.
3. **Counsel review.** Qualified Turkish counsel applies section 3's criteria to the supplied facts and LEG-09's findings and records an opinion for each of T1–T3.
4. **Record the answers.** The owner fills section 1 with the reviewed outcome, owner, reviewer, evidence reference (no privileged content), and date, and adds an approved `D0xx` entry to `docs/01_DECISIONS.md`.
5. **Release gate.** Any registration action, or any conclusion that registration is unnecessary, is reviewed against the LEG-08–LEG-11 launch-gate line in `docs/25_LEGAL_APPROVAL_TRACKER.md` section 5 before a real-user pilot or public launch.

Issue #203 stays open until T1–T3 are resolved by recorded, reviewed answers, not by this draft.
