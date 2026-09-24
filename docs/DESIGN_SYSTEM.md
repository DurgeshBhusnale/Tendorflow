# Design System — Composed Professional

The canonical UI specification for the TenderFlow internal operations tool. It governs every
screen under `frontend/`. Where this document and a component disagree, this document wins and
the component has a bug.

Nothing here changes behaviour. Features, permissions, payloads, and validation are defined by
`PRD.md` and `API_CONTRACT.md`; this file only describes how they look.

> **This replaces "Elevated Minimalism", the first prototype's language.** That spec asked for
> zero border-radius, a white rail, and serif headings on every screen. Built out across eleven
> modules it read as unfinished rather than restrained — square white boxes on a white page, with
> nothing framing the workspace. What changed, and why, is recorded inline below; the shape of the
> app did not change at all.

---

## 1. Core Visual Principles

- **Framed, not floating.** One dark navy rail frames a light content column. The rail is the
  only dark surface in the app, and it is what makes the content read as a workspace.
- **Softened geometry.** Corners are rounded on a small, closed scale (see §2). Cards, fields,
  buttons and pills all sit on it, so no surface looks like a table drawn in a terminal.
- **Data-dense but scannable.** Optimised for desktop efficiency: a filled table-header strip,
  two-line identity cells, tinted initials, and a status dot on every pill.
- **Editorial only where it brands.** The serif is the wordmark's, not every heading's; headings
  are the sans face, bold and tight.
- **Quiet colour, used meaningfully.** Grayscale carries structure; indigo carries primary
  actions; a tone (green / amber / blue / red / slate) carries state and never decoration.

---

## 2. Design Tokens

Tokens live in `frontend/src/index.css` as HSL triplets on `:root`, and are exposed to Tailwind
as semantic colour names in `frontend/tailwind.config.ts`. **Always reach for the token class
(`bg-card`, `text-muted-foreground`, `border-border`), never a raw hex.**

### Colour

| Role | Hex | Token / class |
| --- | --- | --- |
| Primary surface | `#F4F6F9` | `bg-background` |
| Card / container / drawer | `#FFFFFF` | `bg-card` |
| Primary accent (actions) | `#2952E3` | `bg-primary`, `text-primary` |
| Deep navy (rail, brand, scrims, sign-in) | `#0B1424` | `bg-ink`, `bg-sidebar` |
| Headings / primary text | `#101828` | `text-foreground` |
| Body / secondary text | `#475467` | `text-muted-foreground` |
| Borders | `#E4E7EC` | `border-border` |
| Hover tint | `#F9FAFB` | `hover:bg-accent` |
| Muted fill / table header / dividers | `#F2F4F7` | `bg-muted`, `border-divider` |
| Destructive | `#D92D20` | `text-destructive`, `bg-destructive` |

Rail-only tokens, because the rail is the one dark surface: `bg-sidebar` `#0B1424`,
`text-sidebar-foreground` `#AEB8CA` (resting nav text), `bg-sidebar-active` `#1C2B4B` (the active
item's fill), `text-sidebar-muted` `#7D8BA3` (section eyebrows), `border-sidebar-border` `#16213A`.

Body text darkened from `#6B7280` to `#475467` with the palette change: secondary text on a white
card at 14px was the weakest contrast in the old build, and a data tool is read at length.

Status pill palette (`StatusPill`) — a tinted fill, a border a step darker, and a solid dot:

| Tone | Fill / border / text | Dot |
| --- | --- | --- |
| `green` — Paid, Active, Key Created/Returned | `emerald-50` / `emerald-200` / `emerald-700` | `emerald-500` |
| `amber` — Pending | `amber-50` / `amber-200` / `amber-700` | `amber-500` |
| `blue` — part-way states (Partially Paid, EMD With Us) | `blue-50` / `blue-200` / `blue-700` | `blue-500` |
| `red` — Key Issued, error | `red-50` / `red-200` / `red-700` | `red-500` |
| `slate` — neutral, Inactive, unknown | `bg-muted` / `border-border` / `text-muted-foreground` | `gray-400` |

The dot is not decoration: it is what separates two adjacent pills at a glance, and it keeps the
state legible without relying on hue alone.

`blue` exists so *Partially Paid* is not another amber pill sitting next to
*Pending*: they are different states and the eye has to separate them at a
glance. Key Issued moved from amber to red because a key that has left the
office is a live exposure, not a pending task.

**Always give a status map a fallback tone.** A retired enum value can still
come back from the API on an old row (`DATABASE_SCHEMA.md` §7), so index with
`STATUS_TONES[value] ?? "slate"` rather than assuming the key exists.

### Typography

- **Headings (h1–h3):** Plus Jakarta Sans, bold, `-0.02em` tracking. Applied globally in the base
  layer, so a bare `<h1>` is already correct. Page titles are 28px, card titles 16px.
- **Body, labels, table data:** Plus Jakarta Sans, 14px base, regular to semibold. Field labels
  are 13px semibold; secondary lines in a cell are 13px muted.
- **Wordmark only:** Playfair Display, via `.font-display` — the rail's header, the mobile bar and
  the sign-in panel. The serif brands; it no longer styles every heading on every screen, which is
  what made ops tables read as a magazine spread.
- **Eyebrow** (`.eyebrow`): 11px, semi-bold, uppercase, `0.05em` tracking, muted. Table headers,
  drawer section headings, rail section labels.
- **Numbers** are `tabular-nums` everywhere they are compared down a column: metrics, money,
  quantities.
- Both faces load from Google Fonts in `index.html` with system fallbacks.

### Layout & Spacing

- 8px base grid — prefer even-numbered Tailwind spacing steps.
- **Border radius: a small, closed scale**, set in `tailwind.config.ts` — `sm` 4px, default 6px,
  `md` 8px, `lg` 9px (buttons, fields, nav items, icon chips), `xl` 12px (cards, panels, dropdowns),
  `2xl` 16px (the sign-in card), `full` for pills and dots. The scale is closed so a stray
  `rounded-3xl` can't introduce a curve the rest of the app doesn't use. (This reverses the
  prototype's zero-radius rule; see the note at the top.)
- Borders: `1px solid #E4E7EC`.
- Shadows, all low-elevation: `shadow-card` for containers and raised segments, `shadow-button`
  for filled buttons, `shadow-pop` for dropdowns and dialogs, `shadow-drawer` for the slide-over.
- Page padding: `.page` (`px-8 py-8` at `lg`), sections separated by `space-y-8`; grids of cards
  use `gap-4`.

---

## 3. Global Components

### Sidebar (`components/layout/Sidebar.tsx`)

256px fixed, full height, navy (`bg-sidebar`), no border — the colour change is the edge. A 76px
header carries the serif wordmark alone, its second half in `--primary-light`. The indigo icon
tile that sat beside it is gone: a wordmark *is* the mark, and a generic document glyph next to
it claimed a logo the product does not have.
Links are grouped ("Workspace", "Administration") with `.eyebrow` section labels in
`text-sidebar-muted`; the Administration group renders only for admins, and `lib/nav.ts` is the
single source for both groups.

Active state: a filled `bg-sidebar-active` rounded item with white semibold text. This replaced
the 2px charcoal edge indicator of the prototype — a fill survives being glanced at, a hairline on
the far edge of the rail does not.

The footer carries the signed-in identity in a `bg-white/5` card — a **circular** indigo avatar
with initials (round because it stands for a person, where every other tinted square in the app
stands for a record), name, role — with an icon-only Log out button beside it. This is the only place either appears.

Below `lg` the rail slides off-canvas over a `bg-ink/50` scrim, and a 56px white bar carries the
open button and the wordmark (`components/layout/AppShell.tsx`).

### No Top Bar

The original spec called for a 64px top bar carrying the page title, a global search, and the user
menu. It was built and then removed: the title only ever duplicated the `<PageHeader>` directly
beneath it, and there is no global-search endpoint to wire a search field to — a decorative input
that does nothing is worse than none. Identity and sign-out moved to the sidebar footer; per-page
search lives in each list page's toolbar.

Revisit only if a genuine cross-entity search endpoint is added.

### Page Header (`components/shared/PageHeader.tsx`)

Title, supporting line, actions pinned right.

**No breadcrumb.** It was derived from `lib/nav.ts` and rendered as
`Section / Page` above every title. In an app two levels deep, whose rail
already shows the section and highlights the current page, it restated what was
on screen a centimetre to the left and pushed the title down. Removed for the
same reason the top bar was: it duplicated something the user was already
looking at.

### Table Cards

Every table lives in a `.surface` card that opens with a **`.card-header`**: the card's own name,
a `.count-chip` with the record count, and search or the status filter opposite. Filters that
don't fit go on a second `.toolbar` row beneath it.

This is structural, not decorative — the filled table-header strip must never be the first thing
in a card, or its square corners fight the card's rounded ones. A table card always has a header.

### Data Tables (`components/shared/DataTable.tsx`)

- Header row: `.eyebrow` on a `bg-muted/60` strip with a border top and bottom.
- Rows: horizontal dividers only (`border-divider`), **no zebra striping**, `hover:bg-accent`.
- **Identity cells carry two lines and an `<Avatar>`**: contact person over email (clients),
  contact person over company (tenders, credentials, DSC, EMD), name over `@username` (users).
  Merging the pair into one cell is what buys back the width the avatar costs.
- Attribution cells (`Added/Updated By`) use the `sm` avatar beside the name.
- Numeric, currency, and action columns are right-aligned (`align: "right"`).
- Cells never wrap; the container scrolls horizontally if a table outgrows the viewport.
- Padding is `py-3.5 px-3`, with `first:pl-5 last:pr-5` for the card's edges — tighter than the
  cards and drawers around it, because an eleven-column table has to fit a 1440px desktop before
  it is allowed to be comfortable. Cards and drawers keep the full `px-5`/`px-6`.
- Where a table still overflows, the fix is to **merge a pair of related columns into one
  two-line cell**, not to shrink the type: credentials pairs the editor with the date, clients
  pairs the contact with their email, and the record tables pair contact with company.
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
  than only in a pill. Two tables use it:
  - A DSC key that is out of the office is tinted `bg-red-50/70` across its
    full width, because that is the one thing worth spotting from across the
    room.
  - EMD rows are blue while the deposit is `With Us` and green once
    `Returned`. Held money is deliberately not red: it is an open
    obligation, not a problem.
  - Expense rows are tinted the same way, with two states rather than three:
    `bg-red-100/70` Pending, `bg-emerald-100/70` Paid.
  - Every tender row is tinted by payment state — `bg-red-100/70` Pending,
    `bg-blue-100/70` Partially Paid, `bg-emerald-100/70` Paid — so a screen of
    tenders reads as "what is still owed" before a single figure is read.
    Restate the hover tint (`hover:bg-red-50`) alongside the shade, or the
    colour vanishes under the cursor.
- **`selection`** — adds a leading checkbox column, for tables with a bulk
  action. The header checkbox covers **the rendered page only**, and shows an
  indeterminate state while part of it is ticked; anything wider than the page
  is an explicit, separately labelled opt-in, so a tick never acts on rows the
  user cannot see. Pass it only where the user can act on a selection — a
  checkbox leading to an action they lack permission for is worse than no
  checkbox. The boxes are native inputs tinted with `accent-primary`: the one
  place a browser-drawn control is preferred to a styled one, because its
  keyboard and screen-reader behaviour is free and correct.
- **`onRowClick(row)`** — makes rows activatable and adds `cursor-pointer`. Use
  it only where a row has a detail view (DSC keys open their history). Any cell
  containing its own buttons must wrap them in a `stopPropagation` handler, or
  clicking Edit fires both.

### Avatars (`components/shared/Avatar.tsx`)

Tinted initials, `md` (36px, `rounded-lg`) in identity cells and `sm` (28px, `rounded-md`) in
attribution cells. The tint is hashed from the name, so one client is the same colour on every
screen. It carries no meaning — it is there to give a list of near-identical rows something to
navigate by — so it is `aria-hidden`, with the name always beside it.

### Metric Cards (`components/shared/MetricCard.tsx`)

Label, tinted icon chip in the corner, a 30px bold tabular number, and a `hint` line saying what
the number counts. `tone` picks the chip: `indigo` (counts and totals), `amber` (pending / owed),
`green` (settled / received), `blue` (part-way), `violet` (DSC), `red`, `slate`. A row of metrics
should be scannable by colour as well as by label, so tones stay consistent across pages: amber is
always "still to come", green is always "done".

### Segmented Filter (`components/shared/SegmentedFilter.tsx`)

The status switch on tenders, EMD and expenses: one raised white segment on a `bg-muted` track,
in the `.card-header`. It replaced three copies of a bordered button row whose active state was a
black fill — a filter is a choice between a handful of views, and this reads as one control.

### Forms & Drawers

**Overlays render through a portal into `document.body`** — the drawer and the
confirmation dialog both. `position: fixed` is resolved against the nearest
ancestor with a transform, filter or containing-block property rather than the
viewport, so an overlay left in the page tree can be shifted by a wrapper it
knows nothing about. Portalling makes "covers the screen" true by construction.

Its header uses the same `py-4` as a card header, not a taller one: a drawer
opening beside a card should not appear to start lower than it.

All data entry happens in a right-side slide-over (`components/shared/Drawer.tsx`), 500px wide,
closing on backdrop click or Escape, with background scroll locked while open. A drawer form is a
`flex h-full flex-col` containing `<DrawerBody>` (scrolls) and `<DrawerFooter>` (pinned action bar,
Cancel then submit).

Inputs: 1px border, `rounded-lg`, 40px tall, 14px text, and an indigo focus halo (border plus a
3px `ring-primary/15`). Every field has a `<Label htmlFor>` and a `<FieldError>`. `<DrawerSection>`
groups the fields that belong to one idea under an `.eyebrow` heading, so a long form reads as
three short sections rather than one column of twelve inputs.

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

**Multi-line fields are `ui/textarea.tsx`**, not a taller `Input`. It wears
the same 1px chrome and indigo focus ring, starts at four rows and is
vertically resizable. Use it wherever the value genuinely runs to several
lines — a client's bank details, an expense's note — and say in the hint
whether there is a length limit, because the two current uses differ: bank
details are capped at 500 characters, an expense note is uncapped.

**Conditional fields.** A field that only applies to one state is rendered only
in that state, never disabled-but-visible: the tender form shows Amount Paid
solely for *Partially Paid*, and Payment Mode only once money has changed hands.
Grouped capture (the DSC issued-to block) sits in a bordered `bg-muted` panel
with an `.eyebrow` heading, so it reads as one unit rather than two loose
fields.

### Confirmation Dialogs (`components/shared/ConfirmDialog.tsx`)

Anything destructive confirms in an in-app modal. **`window.confirm` and
`window.alert` are not used anywhere** — they render as unstyled browser chrome,
sit outside the design language entirely, and look like a security prompt rather
than part of the product.

One `<ConfirmProvider>` is mounted in `App.tsx`; pages open the dialog through
`useConfirm()` and never render one themselves:

```tsx
const confirm = useConfirm();
confirm({
  title: "Delete this tender?",
  description: "…what exactly is lost…",
  confirmLabel: "Delete Tender",
  tone: "destructive",
  onConfirm: () => deleteTender.mutateAsync(tender.id),
});
```

- Centred over a `bg-ink/45` scrim, `max-w-md`, `rounded-xl` with `shadow-pop`: header block over
  a bordered action bar.
- **Cancel takes focus**, so Enter on a freshly opened dialog never deletes
  anything. Escape and a scrim click both dismiss.
- The action button is `variant="destructive"` for `tone: "destructive"`.
- `onConfirm` owns the request. The dialog stays open while it is pending and
  renders a failure **inline** in the same red block the forms use, so an error
  never needs a second dialog and no call site needs its own try/catch.
- The title asks the question; the description says what is lost. Deleting a
  user says the attribution goes with it and points at Deactivate instead.

**Signing out confirms too.** It sits one click from the nav, and the way back
is finding a password again — cheap to confirm, irritating to trigger by
accident. It is the one non-destructive action that asks, so its dialog uses
the default tone rather than the red one.

### Sign-in Page (`pages/LoginPage.tsx`)

Split screen. **Left:** the editorial panel on `.login-backdrop` — the brand artwork at
`public/login-bg.svg` over a matching navy wash, carrying the wordmark, serif headline, supporting
line and `Internal use only` eyebrow, all in white. A left-to-right scrim sits over the artwork so
the copy stays legible at any crop, and the artwork is anchored left so the document motif falls in
the panel's right half. **Right:** a 420px white `rounded-2xl` card with `shadow-pop`, on the
standard off-white surface. The card carries no wordmark or logo — the brand lives on the other
half. Below the `lg` breakpoint the editorial panel drops and the card takes the full width.

Two deliberate departures from the rest of the app:

- The submit button is **navy (`variant="ink"`), not indigo.** This is the only primary action in
  the product that isn't indigo; sign-in is a standalone surface with no competing actions.
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
