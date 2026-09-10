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
| `amber` — Pending | `#FFFBEB` | `#D97706` |
| `blue` — part-way states (Partially Paid) | `#EFF6FF` | `#2563EB` |
| `red` — Key Issued, error | `#FEF2F2` | `#DC2626` |
| `slate` — neutral, Inactive, unknown | `#F3F4F6` | `#4B5563` |

`blue` exists so *Partially Paid* is not another amber pill sitting next to
*Pending*: they are different states and the eye has to separate them at a
glance. Key Issued moved from amber to red because a key that has left the
office is a live exposure, not a pending task.

**Always give a status map a fallback tone.** A retired enum value can still
come back from the API on an old row (`DATABASE_SCHEMA.md` §7), so index with
`STATUS_TONES[value] ?? "slate"` rather than assuming the key exists.

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

Below `md` the table is not a table. Nine columns on a 390px screen means either horizontal
scrolling to reach the actions or text too small to read, so each row renders as a card: one value
as the heading, the row actions opposite it, and the rest as labelled pairs. Both renderings come
from the same `columns` array — a column declares its mobile behaviour with `mobile`:

| `mobile` | Effect |
| --- | --- |
| `"title"` | Heads the card. Defaults to the first column if none is marked. |
| `"actions"` | Sits opposite the title instead of in the detail list. |
| `"hide"` | Dropped on mobile — for columns the title already implies. |
| *(unset)* | Becomes a label/value pair. |

Two optional props cover the cases a column config cannot express:

- **`rowClassName(row)`** — classes applied to the whole row, in both the table
  and the card rendering. For flagging a row's state in the row itself rather
  than only in a pill: a DSC key that is out of the office is tinted
  `bg-red-50/70` across its full width, because that is the one thing worth
  spotting from across the room.
- **`onRowClick(row)`** — makes rows activatable and adds `cursor-pointer`. Use
  it only where a row has a detail view (DSC keys open their history). Any cell
  containing its own buttons must wrap them in a `stopPropagation` handler, or
  clicking Edit fires both.

### Forms & Drawers

All data entry happens in a right-side slide-over (`components/shared/Drawer.tsx`), 480px wide,
closing on backdrop click or Escape, with background scroll locked while open. A drawer form is a
`flex h-full flex-col` containing `<DrawerBody>` (scrolls) and `<DrawerFooter>` (pinned action bar,
Cancel then submit).

Inputs: 1px border, 0px radius, 14px text, indigo focus ring. Every field has a `<Label htmlFor>`
and a `<FieldError>`.

**Dropdowns come in two forms**, sharing the same field chrome:

- **`ui/select.tsx`** — the native element. Correct for short, fixed lists where
  every option fits on screen: a status, a role, cash-or-online.
- **`ui/combobox.tsx`** — a searchable single-select. Correct for anything the
  user might have to hunt through, which in practice means every list of
  clients, portals and tender departments. The input doubles as the search box;
  arrow keys and Enter work; `clearable` adds an × for filter dropdowns where
  "no selection" is a valid state. It is controlled (`value` / `onChange`), so
  in a form it is driven by `watch` + `setValue`, not `register`.

  Pass `onSearchChange` when the option list can outgrow one API page, so the
  query goes to the server rather than filtering a truncated snapshot. Always
  seed the currently-selected item into the options when editing, or the field
  blanks out mid-edit as soon as the search stops matching it.

**Conditional fields.** A field that only applies to one state is rendered only
in that state, never disabled-but-visible: the tender form shows Amount Paid
solely for *Partially Paid*, and Payment Mode only once money has changed hands.
Grouped capture (the DSC issued-to block) sits in a bordered `bg-muted` panel
with an `.eyebrow` heading, so it reads as one unit rather than two loose
fields.

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

## 4. Responsive Behaviour

Desktop-first — this is an ops tool used mostly at a desk — but fully usable on a phone. Two
breakpoints carry almost all of it: `md` (768px) switches tables between card and table form, and
`lg` (1024px) switches the navigation between off-canvas and fixed rail.

- **Navigation.** From `lg` the 240px rail is part of the layout. Below it the rail slides
  off-canvas behind a scrim, opened from a slim 56px bar that carries the wordmark and a menu
  button. That bar is the mobile counterpart to the rail, not a reinstated top bar — it never shows
  the page title. The rail closes on navigation, on Escape, and on scrim tap.
- **Page padding** climbs `px-4` → `px-6` → `px-8`. Use the `.page` class rather than repeating the
  ladder; `.toolbar` does the same for a table card's filter strip.
- **Drawers** are full-bleed below `sm` and 480px above it.
- **Filter controls** are full-width on phones and auto-width from `sm`.
- **Page headers** stack the title above its actions below `sm`.
- Shell height uses `h-dvh`, not `h-screen`, so mobile browser chrome doesn't cut off the sidebar
  footer.

Verify with `frontend/scripts/smoke-mobile.mjs`, which drives a real device profile rather than a
narrowed desktop window. It walks every page, opens the rail and a drawer, and fails on any element
whose right edge passes the viewport or on any page that scrolls horizontally — the failure mode
that is easy to miss visually and breaks the whole layout.

---

## 5. Functional Display Rules

- **Currency.** Always rupees with Indian digit grouping via `formatCurrency`. Whole amounts drop
  the paise (`₹45,200`); anything with paise always shows both decimals (`₹8,753.50`). Never
  format money inline.
- **Dates.** Always `formatDate` — `30 Aug 2026`, rendered in Asia/Kolkata per PRD §5.
- **Statuses.** Always a `StatusPill`, never plain text.
- **Calculated fields.** Read-only and visibly inert: muted background, bordered block, with a
  line explaining that the server computes the real value (see the tender total,
  which shows Paid and Remaining beneath it once a payment exists).
- **Phone numbers.** Ten digits, Indian mobile, via the shared `phoneSchema`.
  The backend normalizes and stores the bare ten digits, so what comes back may
  not be what was typed — never assume the input's formatting survives.
- **Viewport.** Desktop-first at 1440px, usable down to 360px. Nothing scrolls horizontally at any
  width.
