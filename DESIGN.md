---
name: ServisimiBul
description: Calm, practical school-transport discovery in a navy and teal transit editorial system.
colors:
  navy-950: "#0a1c30"
  navy-900: "#102843"
  navy-800: "#183954"
  navy-700: "#294b66"
  teal-700: "#066b70"
  teal-600: "#087f83"
  teal-500: "#07959b"
  teal-100: "#d8eff0"
  yellow-500: "#e9b929"
  yellow-100: "#fff3c4"
  neutral-0: "#ffffff"
  neutral-25: "#fbfcfb"
  neutral-50: "#f5f7f6"
  neutral-100: "#e9eeec"
  neutral-200: "#d7dfdc"
  neutral-500: "#63716c"
  neutral-700: "#3f4d49"
  red-700: "#9a312b"
  red-100: "#fce9e7"
  amber-700: "#82530c"
  amber-100: "#fff2d8"
  muted: "#53635e"
  surface-soft: "#edf3f1"
  border-strong: "#aebdb8"
  success-text: "#185c3c"
  success-surface: "#dff3e8"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(2.65rem, 5.7vw, 5.4rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "clamp(2.25rem, 7vw, 4.75rem)"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  section:
    fontSize: "clamp(1.65rem, 4vw, 2.4rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "0.9rem"
    fontWeight: 400
  label:
    fontWeight: 750
  status:
    fontSize: "0.8rem"
    fontWeight: 750
    lineHeight: 1.2
rounded:
  small: "0.75rem"
  medium: "1rem"
  large: "1.5rem"
  pill: "999px"
spacing:
  "1": "0.25rem"
  "2": "0.5rem"
  "3": "0.75rem"
  "4": "1rem"
  "5": "1.25rem"
  "6": "1.5rem"
  "8": "2rem"
  "10": "2.5rem"
  "12": "3rem"
  "16": "4rem"
components:
  button-primary:
    backgroundColor: "{colors.teal-600}"
    textColor: "{colors.neutral-0}"
    rounded: "{rounded.small}"
    padding: "0.7rem 1rem"
  button-secondary:
    backgroundColor: "{colors.neutral-0}"
    textColor: "{colors.navy-900}"
    rounded: "{rounded.small}"
    padding: "0.7rem 1rem"
  button-danger:
    backgroundColor: "{colors.neutral-0}"
    textColor: "{colors.red-700}"
    rounded: "{rounded.small}"
    padding: "0.7rem 1rem"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.teal-700}"
    rounded: "{rounded.small}"
    padding: "0.7rem 1rem"
  surface-card:
    backgroundColor: "{colors.neutral-0}"
    rounded: "{rounded.medium}"
  input:
    backgroundColor: "{colors.neutral-0}"
    textColor: "{colors.navy-950}"
    rounded: "{rounded.small}"
    padding: "0.78rem 0.85rem"
  status-info:
    backgroundColor: "{colors.teal-100}"
    textColor: "{colors.teal-700}"
    typography: "{typography.status}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.65rem"
  navigation-active:
    backgroundColor: "{colors.teal-100}"
    textColor: "{colors.teal-700}"
    rounded: "{rounded.small}"
    padding: "0.55rem 0.75rem"
---

# Design System: ServisimiBul

## Overview

**Creative North Star: "Calm Transit Editorial"**

ServisimiBul pairs the clarity of a practical transport directory with calm editorial hierarchy. Deep navy supplies structure, teal marks useful actions and selected states, warm yellow adds a small point of recognition, and pale neutral surfaces keep dense forms readable. This documents the incumbent UI-01 system and its approved UI-02 homepage extension; it does not establish a replacement identity.

The homepage extends that world with self-hosted Manrope headings and original, non-identifying İstanbul school-shuttle photography. The image establishes context while the live search remains the working product. Trust comes from honest labels, visible constraints, and recoverable states rather than promotional badges or unsupported assurances.

**Key Characteristics:**

- Calm navy structure with teal actions and restrained yellow detail.
- Rounded, bordered form surfaces with generous readable spacing.
- Expressive homepage headings over familiar UI body typography.
- Visible loading, empty, error, selected, and disabled states.

## Colors

The palette combines deep transit navy, clear teal, warm yellow, and slightly green neutral surfaces. Frontmatter values mirror the stylesheet; semantic aliases in CSS remain authoritative. Sidecar tonal ramps are synthesized OKLCH preview metadata, not additional application color tokens.

### Primary

- **Transit Navy** (`navy-950` through `navy-700`): primary text, brand structure, dark workspace navigation, and the homepage hero. White text carries contrast on dark surfaces.
- **Working Teal** (`teal-700`, `teal-600`, `teal-500`, `teal-100`): action text, filled buttons, focus, selected navigation, and informational badges. The reusable primary Button uses `teal-600`; existing page-level primary buttons use the accent alias resolving to `teal-700`.

### Secondary

- **Warm Signal Yellow** (`yellow-500`, `yellow-100`): the small brand-mark detail, homepage hero action, and text selection. It is an accent within the established world, not a replacement primary color.

### Neutral

- **White and Quiet Canvas** (`neutral-0`, `neutral-25`, `neutral-50`, `surface-soft`): cards, header, page background, and selected summaries.
- **Structural Neutrals** (`neutral-100`, `neutral-200`, `border-strong`): subdued status fills, borders, and stronger boundaries.
- **Supporting Ink** (`neutral-500`, `neutral-700`, `muted`): supporting content and inactive navigation; core text uses navy.
- **Semantic Feedback** (`red-*`, `amber-*`, `success-*`): danger, warning, and success text/fill pairings. Keep their written status labels; color alone does not explain state.

**The Role Continuity Rule.** Preserve the incumbent palette and semantic aliases when extending screens. The yellow hero action is a homepage context, not a global button recolor.

## Typography

**Display Font:** Manrope, sans-serif. The variable font is self-hosted at `/fonts/manrope/Manrope-Variable.ttf`, with its OFL license alongside it; `font-display: swap` is configured.

**Body Font:** The incumbent Inter-first UI/system stack in the frontmatter. Inter is a preferred family in CSS, not a newly bundled body font; the system fallback remains valid.

**Code Font:** The native `ui-monospace, SFMono-Regular, Consolas, monospace` stack is reserved for structured technical input such as the admin tariff JSON editor. It is a semantic editor role, not a brand or display typeface.

**Character:** Manrope gives the homepage headline and search heading a compact editorial voice. Form controls, navigation, results, and workspaces retain the established body stack.

### Hierarchy

- **Display:** the homepage hero uses the display role, balanced wrapping and a narrow measure (12ch, 14ch below the tablet breakpoint). At compact widths its size becomes `clamp(2.4rem, 12vw, 3.75rem)`.
- **Headline:** other page h1 elements use the incumbent headline role.
- **Section:** reusable section headings use the section role; the homepage search heading instead uses Manrope and `clamp(1.65rem, 3vw, 2.3rem)` with tight tracking.
- **Body:** controls inherit the body font. Supporting paragraphs commonly use line-height from 1.5 to 1.7 and measures of roughly 60–68ch where specified; there is no universal body line-height token.
- **Code:** structured configuration editors use the native monospace stack at `0.9rem` for predictable character alignment; ordinary labels, controls, and prose must not inherit it.
- **Label:** strong sentence-case labels identify controls; status badges use the compact status role. The homepage begins directly with its heading, without an eyebrow.

**The Display Scope Rule.** Keep Manrope on the approved homepage headings. Do not replace body, control, or workspace typography as a side effect of extending the homepage.

## Layout

The shared public shell has a sticky header and a centered content container capped at 72rem. Standard page padding scales with the viewport. The workspace pairs a navy sidebar (14–18rem) with the content column; it changes to a mobile bar and off-canvas sidebar at 44rem.

The homepage is a full-width extension: a navy hero with a centered 76rem inner rail, followed by a 72rem search surface overlapping the hero and a matching results rail. The desktop hero uses two columns; it stacks at 60rem. Its portrait image becomes 16:9 at that breakpoint and 4:3 at compact widths. This composition belongs to the homepage rather than every future screen.

School-location filters use three columns, pickup controls use two, and both become one column at 44rem. School results remain separated list rows with actions and pagination. Operator results use an auto-fit grid with a 22rem minimum constrained to available width. At 44rem actions and summaries stack; at 36rem reusable buttons fill their container and state-panel actions move to a new row. The shell supports a 320px minimum width; at 24rem the wordmark is hidden while the mark remains.

Use the existing quarter-rem spacing scale. Separate school geography from pickup geography in both grouping and language. Keep server-backed filters, sorting, pagination, selection, loading, empty, error, and retry states visible through layout changes.

## Elevation & Depth

The system combines pale tonal layers, thin borders, and soft ambient shadows. The reusable SurfaceCard is flat with a border; existing form, school, and empty-state cards add the soft shadow. The raised shadow belongs to floating mobile navigation. The homepage image and its dark caption have stronger local shadows, appropriate to the editorial hero rather than a new global elevation scale.

The exact soft and raised shadow values, durations, easing, and breakpoints are recorded in the sidecar. Controls use fast transitions; content uses the page duration. Existing page-level buttons can lift on pointer hover; reusable Button primitives have no separate hover color or lift in the source. Reduced-motion preferences remove page transitions and loading motion and disable smooth scrolling.

## Shapes

Small rounded corners belong to controls, medium corners to surfaces, and large corners to the homepage photograph. Pills distinguish compact statuses and selected geography labels. Most form surfaces keep a thin visible boundary. The brand lockup retains its navy rounded-square location mark, white pin, yellow point, and two-tone wordmark.

## Components

### Buttons

The reusable Button exposes `primary`, `secondary`, `danger`, and `quiet` tones. All use small corners, strong labels, a minimum height of 2.75rem, and compact horizontal padding. Primary is teal with white text and a small colored shadow; secondary is white with a neutral border and navy text; danger is white with a pale red border and red text; quiet is transparent with teal text. Disabled buttons reduce opacity and remove transforms.

Existing page-level buttons coexist with these primitives. Their primary fill uses the stronger teal accent; their pointer-hover rules can lift them. The homepage hero specializes its primary action to yellow/navy and its secondary action to translucent white. Preserve these contextual distinctions rather than silently normalizing them.

### Status Badges

The compact pill supports neutral, info, success, warning, and danger tones. Pair each fill/text treatment with a readable label. These badges describe state; they are not invented certification or safety endorsements.

### Cards / Containers

SurfaceCard supplies only a white surface, neutral border, and medium corners; consumers add layout and padding. Existing form cards use responsive padding and soft depth. SectionShell supplies a consistent title, optional description, and vertical rhythm. StatePanel combines the surface with a state mark, title, explanation, and optional action; loading is polite and busy, while errors use alert semantics.

### Inputs / Fields

Controls have white backgrounds, small corners, and a thin muted green-gray stroke. Focus uses teal with a visible three-pixel mixed-color outline; invalid controls use the danger border. FormField keeps labels, hints, errors, and accessible descriptions associated with the control. Preserve disabled dependent selectors and clear instructions when a prerequisite selection is missing.

### Navigation

Public navigation uses sentence-case links with generous touch height; the active item has a pale teal fill. At compact widths it becomes a floating panel controlled by the menu button. Workspace navigation remains in the established navy sidebar and mobile drawer. Retain visible focus and the skip link.

### Discovery Homepage

The hero introduces exact-school plus separately selected pickup geography, links to the live search anchor, and exposes the genuine `/demands` board. Its original shuttle photograph is contextual imagery, not proof of a listed operator or service guarantee. Preserve non-identifying imagery without legible plates, child identities, or invented endorsements. The search starts with school-location filters, then presents the selected school and separate pickup controls. Result cards preserve direct phone contact and optional offering details; tariff references remain separate from personal price quotes.

## Do's and Don'ts

### Do:

- **Do** reuse UI-01 tokens, primitives, responsive behavior, and state treatments.
- **Do** retain clear labels and visible keyboard focus alongside color changes.
- **Do** keep school location and pickup location visibly separate.
- **Do** scope the Manrope and photography extension to the approved homepage context.
- **Do** use original, non-identifying shuttle imagery with honest contextual text.

### Don't:

- **Don't** replace the incumbent navy, teal, yellow, and neutral identity during an extension.
- **Don't** turn the homepage yellow action into a global primary-button change.
- **Don't** add an eyebrow above the approved homepage heading.
- **Don't** hide discovery loading, empty, error, retry, selected, or pagination states for visual simplicity.
- **Don't** fabricate safety badges, operator endorsements, testimonials, or usage metrics.
