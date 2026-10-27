# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Parents anonymously searching for school-transport operators in the İstanbul pilot, plus registered operators and administrators managing publication data.

## Product Purpose

ServisimiBul helps a parent select a real school and a separate pickup neighborhood, then find operators who state that they serve that exact school and neighborhood. Success means reaching a relevant operator directly without creating a parent account or disclosing a child or precise address.

## Positioning

Discovery is based on an exact school plus per-school neighborhood coverage while keeping the school's district distinct from the pickup district.

## Operating Context

The public homepage is both the product introduction and the live discovery workflow. Parents filter and paginate the server-backed school catalog, select a school, choose a pickup district and neighborhood in the same province, and review operator matches. A separate demand board supports routes with unmet demand.

## Capabilities and Constraints

- Anonymous public discovery; no booking, payment, GPS, route optimization, or student records.
- School search preserves server-side filtering, sorting, and pagination.
- Pickup neighborhood may be in another district of the same province.
- Operator profiles may appear without a vehicle or service offering.
- Neighborhood coverage is not an address-level service guarantee.
- UKOME tariffs are official reference bands, not personal quotes or inferred fares.
- React, TypeScript, Vite, live Spring Boot APIs, and the existing UI-01 design system remain authoritative.

## Brand Commitments

The product name is ServisimiBul. Its voice is calm, direct, practical, and honest. The established visual system uses deep navy, teal, warm yellow, and neutral surfaces.

## Evidence on Hand

The repository contains the live discovery implementation, mocked and real full-stack tests, UI-01 tokens/components, and approved product decisions. No testimonials, safety certifications, operator endorsements, or usage metrics may be fabricated.

## Product Principles

- Preserve discovery truth before simplifying presentation.
- Separate school location from pickup location in language and interaction.
- Earn trust through clear constraints and recoverable states, not unsupported claims.
- Keep anonymous discovery fast, accessible, and usable on compact mobile screens.

## Accessibility & Inclusion

Public flows target WCAG 2.2 AA, keyboard operation, reduced motion, 200% text reflow, and responsive behavior at 320, 390, 768, and 1440 pixels.
