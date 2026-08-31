# Design System — Elevated Minimalism

The canonical UI specification for the TenderFlow internal operations tool. It governs every
screen under `frontend/`. Where this document and a component disagree, this document wins and
the component has a bug.

Nothing here changes behaviour. Features, permissions, payloads, and validation are defined by
`PRD.md` and `API_CONTRACT.md`; this file only describes how they look.

---

## 1. Core Visual Principles

- **Minimalist & architectural.** High contrast, sharp edges, zero border-radius.
- **Data-dense but scannable.** Optimised for desktop efficiency: generous internal padding,
  tight structural grouping.
- **Editorial typography.** A sophisticated serif for hierarchy, a modern high-readability sans
  for data.
- **Monochromatic foundation.** White space and grayscale carry the structure; a single deep
  indigo carries primary actions and intent.

---

## 2. Design Tokens

Tokens live in `frontend/src/index.css` as HSL triplets on `:root`, and are exposed to Tailwind
as semantic colour names in `frontend/tailwind.config.ts`. **Always reach for the token class
(`bg-card`, `text-muted-foreground`, `border-border`), never a raw hex.**

### Colour

| Role | Hex | Token / class |
| --- | --- | --- |
| Primary surface | `#F8F9FA` | `bg-background` |
| Card / container / sidebar | `#FFFFFF` | `bg-card`, `bg-sidebar` |
| Primary accent (actions) | `#2952E3` | `bg-primary`, `text-primary` |
| Deep charcoal (branding, active indicator) | `#1A1A1A` | `bg-ink`, `text-ink` |
| Headings / primary text | `#111827` | `text-foreground` |
| Body / secondary text | `#6B7280` | `text-muted-foreground` |
| Borders | `#E5E7EB` | `border-border` |
| Hover tint | `#F3F4F5` | `hover:bg-accent` |
| Muted fill / table dividers | `#F3F4F6` | `bg-muted`, `border-divider` |

Status pill palette (`StatusPill`, exact Tailwind defaults):

| Tone | Background | Text |
| --- | --- | --- |
| `green` — Paid, Active, Key Created/Returned | `#ECFDF5` | `#059669` |
| `amber` — Pending, Key Issued | `#FFFBEB` | `#D97706` |
| `red` — Lost, error | `#FEF2F2` | `#DC2626` |
| `slate` — neutral, Inactive | `#F3F4F6` | `#4B5563` |

### Typography

- **Headings (h1–h3):** Playfair Display, semi-bold, tight tracking. Applied globally in the
  base layer, so a bare `<h1>` is already correct. `font-display` applies it elsewhere.
- **Body, labels, table data:** Plus Jakarta Sans, 14px base, regular to medium.
- **Eyebrow** (`.eyebrow`): 11px, semi-bold, uppercase, `0.08em` tracking, muted. Used for table
  headers, metric labels, and section headings in the sidebar.
- Both faces load from Google Fonts in `index.html` with system fallbacks.

### Layout & Spacing

- 8px base grid — prefer even-numbered Tailwind spacing steps.
- **Border radius: `0` everywhere.** Enforced by overriding the whole `borderRadius` scale in
  `tailwind.config.ts`, so no `rounded-*` class anywhere can reintroduce a curve.
- Borders: `1px solid #E5E7EB`.
- Shadows: low-elevation only — `shadow-card` for containers, `shadow-drawer` for the slide-over.
- Page padding: `px-8 py-8`, sections separated by `space-y-8`.

---

## 3. Global Components

### Sidebar (`components/layout/Sidebar.tsx`)

240px fixed, full height, white, right border only. Wordmark in a 64px header. Links are grouped
("Workspace", "Administration") with `.eyebrow` section labels; the Administration group renders
only for admins. Active state: light-gray rectangular background, semi-bold text, and a 2px
charcoal indicator on the right edge.

The footer carries the signed-in identity — square charcoal avatar with initials, name, role —
above a full-width outlined Log out button. This is the only place either appears.

### No Top Bar

The original spec called for a 64px top bar carrying the page title, a global search, and the user
menu. It was built and then removed: the title only ever duplicated the `<PageHeader>` directly
beneath it, and there is no global-search endpoint to wire a search field to — a decorative input
that does nothing is worse than none. Identity and sign-out moved to the sidebar footer; per-page
search lives in each list page's toolbar.

Revisit only if a genuine cross-entity search endpoint is added.

### Data Tables (`components/shared/DataTable.tsx`)

- Header row: `.eyebrow`, bottom border in `border-border`.
- Rows: horizontal dividers only (`border-divider`), **no zebra striping**, hover tint.
- Numeric, currency, and action columns are right-aligned (`align: "right"`).
- Cells never wrap; the container scrolls horizontally if a table outgrows the viewport.
- Padding is `py-4 px-4`. This is the one deliberate deviation from the spec's `px-6`: at `px-6`
  the nine-column tenders table pushed its Actions column off a 1440px desktop. Cards and drawers
  keep the full `px-6`.
- Row actions are icon-only (`RowActions`) with `aria-label` + `title`, for the same reason.
- **Every in-table action is an `outline` button, never `ghost`.** A ghost button in a table cell
  reads as static text until hovered; the 1px border is what makes it legible as pressable.

### Forms & Drawers

All data entry happens in a right-side slide-over (`components/shared/Drawer.tsx`), 480px wide,
closing on backdrop click or Escape, with background scroll locked while open. A drawer form is a
`flex h-full flex-col` containing `<DrawerBody>` (scrolls) and `<DrawerFooter>` (pinned action bar,
Cancel then submit).

Inputs: 1px border, 0px radius, 14px text, indigo focus ring. Every field has a `<Label htmlFor>`
and a `<FieldError>`. Selects are the native element wearing the same chrome (`ui/select.tsx`), so
`{...register()}` keeps working.

### Sign-in Page (`pages/LoginPage.tsx`)

Split screen. **Left:** the editorial panel on `.login-backdrop` — the brand artwork at
`public/login-bg.svg` over a matching navy wash, carrying the wordmark, serif headline, supporting
line and `Internal use only` eyebrow, all in white. A left-to-right scrim sits over the artwork so
the copy stays legible at any crop, and the artwork is anchored left so the document motif falls in
the panel's right half. **Right:** a 400px white card on the standard off-white surface. The card
carries no wordmark or logo — the brand lives on the other half. Below the `lg` breakpoint the
editorial panel drops and the card takes the full width.

Two deliberate departures from the rest of the app:

- The submit button is **charcoal (`variant="ink"`), not indigo.** This is the only primary action
  in the product that isn't indigo; sign-in is a standalone surface with no competing actions.
- The password field has a show/hide toggle. Purely client-side — it flips the input `type`.

The wordmark's accent half uses `--primary-light` (a lifted indigo) rather than `--primary`;
`#2952E3` has too little contrast on navy. It is applied as `text-[hsl(var(--primary-light))]`
rather than a registered Tailwind colour deliberately — a single-use shade isn't worth a config
entry, and config changes only take effect after a dev-server restart.

Not built, though both appear in the reference design: a **Forgot password?** link and
**Privacy / Terms / Support** footer links. There is no password-reset endpoint and no legal or
support pages in an internal tool, and a link that goes nowhere is worse than its absence. The
administrator note in the card covers the reset case in prose. Add them only alongside the
features they'd point at.

### Empty States

Minimalist bordered icon tile + serif title + one line of description + the primary add action.

### Metric Cards

`.eyebrow` label, optional corner icon, value, optional hint line. The value is set in the **sans**
face with `tabular-nums`, not the display serif — Playfair's old-style numerals read as decorative
at KPI size. The serif is for headings; numbers are data.

---

## 4. Functional Display Rules

- **Currency.** Always rupees with Indian digit grouping via `formatCurrency`. Whole amounts drop
  the paise (`₹45,200`); anything with paise always shows both decimals (`₹8,753.50`). Never
  format money inline.
- **Dates.** Always `formatDate` — `30 Aug 2026`, rendered in Asia/Kolkata per PRD §5.
- **Statuses.** Always a `StatusPill`, never plain text.
- **Calculated fields.** Read-only and visibly inert: muted background, bordered block, with a
  line explaining that the server computes the real value (see the tender total).
- **Viewport.** Designed for desktop at 1440px. Every table fits that width without horizontal
  scrolling.
