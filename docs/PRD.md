# Product Requirements Document — Tender Filling Business Internal Tool

**Status:** v2 (updated for Python + React stack, monorepo, Vercel hosting)
**Audience:** Developer(s) and Claude Code
**Scope:** Working prototype covering 5 modules. UI polish deferred; focus on correct behavior.

---

## 1. Purpose

An internal, authentication-gated web application for a tender-filling business. Employees onboard clients, store portal login credentials, log tender transactions with pricing and status, and track the physical location of client DSC (Digital Signature Certificate) USB keys stored in the office. Admins additionally manage the master dropdown lists (Portals, Tender Departments), onboard and remove user accounts, and are the only role that can delete records or see revenue totals.

Nothing about this app is public. There is no landing page, no self-signup, no SEO, no public API. Every route requires a valid session.

---

## 2. Personas

| Persona | Description | Primary goals |
|---|---|---|
| **Admin** | Business owner / senior staff. | Manage master dropdown lists (Portals, Tender Departments). Onboard, deactivate and delete user accounts. Delete records. See revenue and receivables totals. |
| **Employee** | Operational staff. | Onboard clients. Save portal credentials for each client. Log tender transactions and payment status. Log and locate DSC keys. |

Both personas share full read access across every data module — this is a shared internal tool, not a per-user segregated system. Write access differs: Employees can create records and edit/delete records they created; Admins can edit/delete anything.

---

## 3. Access Control Model

### 3.1 Authentication

- Single login page at `/`. Email + password form.
- Backend endpoint `POST /api/auth/login` validates against bcrypt-hashed passwords in the `users` table and issues a **JWT access token** (short-lived, ~30 min) and a **JWT refresh token** (long-lived, ~7 days).
- Frontend stores the access token in memory (React state) and the refresh token in `localStorage`. Every API request sends `Authorization: Bearer <access_token>`.
- When the access token expires, the frontend calls `POST /api/auth/refresh` with the refresh token to get a new access token.
- Logout clears both tokens client-side and calls `POST /api/auth/logout` (which is a no-op for stateless JWTs but reserved for future token blacklisting).
- **No self-signup.** New accounts are provisioned exclusively via `POST /api/admin/users` by an existing Admin.

### 3.2 Route Protection

- **Frontend:** a `<ProtectedRoute>` wrapper checks for a valid token in auth context. If absent, redirect to `/`. A separate `<AdminRoute>` additionally checks the current user's role. The React Router configuration composes these around each page.
- **Backend:** every FastAPI router (except `/api/auth/login` and `/api/health`) depends on `get_current_user`, which parses the `Authorization` header, verifies the JWT signature, checks expiry, and loads the user from the DB. Admin-only endpoints additionally depend on `require_admin`, which returns 403 if the user's role is not `admin`.

### 3.3 Permission Matrix

| Capability | Admin | Employee |
|---|:---:|:---:|
| Log in / log out | ✅ | ✅ |
| View Clients / Credentials / Tenders / DSC data | ✅ (all) | ✅ (all) |
| Create records in any module | ✅ | ✅ |
| Edit **any** record, including others' | ✅ | ✅ |
| Delete records in any module | ✅ | 🚫 |
| View tender KPI totals (revenue / receivables) | ✅ | 🚫 |
| Manage master **Portals** list | ✅ | 🚫 (read-only) |
| Manage master **Tender Departments** list | ✅ | 🚫 (read-only) |
| Onboard / delete user accounts | ✅ | 🚫 |

**There is no ownership axis.** Editing is open to every signed-in user across
all four record modules, and `created_by` is re-set to the acting user on each
update — so it names *the last person to touch the row*, not its author. The UI
labels the column "Added/Updated By" and pairs it with `updated_at`.

Deletion is admin-only **as a direct consequence**: with `created_by` tracking
the latest editor, an ownership check on delete would hand deletion rights to
whoever edited a row most recently, which is worse than no check at all.
Deleting a client also cascades to their credentials, tenders and DSC keys.

Authorization is enforced in the service layer and by router dependencies, not
by database-level RLS (we're not using Supabase Auth, so `auth.uid()` is not
available at the DB layer). The pattern is now a role check at the router:

```python
@router.delete("/{client_id}")
async def delete_client(
    client_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),   # not an ownership check
):
    await client_service.delete_client(session, client_id)
```

---

## 4. Modules

### 4.1 Module 0 — Authentication & User Management

**Login screen (`/`)**
- **Username** + password inputs, "Sign In" button. Sign-in is by username, not
  email; email remains a required contact address but is not a credential.
- Inline error state on invalid credentials. An unknown username and a wrong
  password produce the same error, so the form cannot enumerate accounts.
- Small helper text: "Access is provided by your administrator."

**Admin user management (`/admin/users`)**
- Table of all accounts: Name, Username, Email, Role, Date Added, Status.
- "Onboard User" action opens a form: Full Name, **Username**, Email, Temporary
  Password, Role (Admin / Employee). Username and email are both required;
  username is lowercased and limited to 3-30 chars of `a-z0-9._-`, and cannot be
  changed afterwards.
- Admins can toggle a user active/inactive (soft disable) **or delete them
  outright**. Deletion is permanent: `created_by` foreign keys are
  `ON DELETE SET NULL`, so the person's records survive but lose their
  attribution. Deactivation is the option that preserves it, and the
  confirmation dialog says so.
- Two guards: an admin cannot delete their own account, and the last active
  admin cannot be deleted, demoted or deactivated.

**Bootstrap:** the very first Admin is created via a one-off Python script (`app/scripts/create_admin.py`) since there's no seed Admin to invite one through the UI. Script prompts for name/username/email/password and inserts directly.

---

### 4.2 Module 1 — Client Onboarding (`/clients`)

**Purpose:** entry point for all downstream modules. Every credential, tender, and DSC key belongs to a client.

**Fields:**
| Field | Type | Rules |
|---|---|---|
| `contact_person_name` | text | required, 1–120 chars |
| `company_name` | text | required, 1–200 chars |
| `contact_number` | text | required, 7–20 chars, digits + optional `+`/spaces/dashes |
| `email` | text | required, valid email format, **unique across all clients** |

**UI:**
- Page shows a "Total Active Clients: N" metric badge at the top.
- Table columns: Contact Person, Company Name, Contact Number, Email, Onboarded By, Date Added, actions menu.
- Search box filters by any of contact person / company / email (server-side).
- "+ Add Client" button opens a drawer or modal with the 4 fields.
- Duplicate email → inline error "This email is already onboarded to another client."

---

### 4.3 Module 2 — Credentials Vault (`/credentials`)

**Purpose:** store portal login credentials for each client so any employee can log in to file their tenders.

**Admin sub-workflow (`/admin/portals` or a tab on `/credentials`):**
- Manage the master `portals` table.
- Fields: `name` (unique), `is_active` (boolean).
- Inactive portals disappear from the employee-facing dropdown but historic credential rows referencing them remain intact.

**Employee sub-workflow:**
- Form fields:
  1. Client (searchable select — populated from Module 1)
  2. Portal (select — populated from admin-managed `portals` table, active only)
  3. Login identifier — optional text ("Username / Email / Phone")
  4. Password — text input, stored as-is per spec (see security note below)
- Table columns: Client, Portal, Login Identifier, Password (masked, click-to-reveal), Added By, Date, actions menu.
- Search and filter by Client Name or Portal Name.

**Security note (accepted trade-off):** the spec calls for a plaintext password field. For a prototype this is stored as `text` in Postgres. Before this app handles real production credentials, either:
- encrypt at rest via `pgcrypto` (symmetric key stored as env var), or
- application-layer encrypt using `cryptography.fernet` before insert, decrypt on read.

Flagged in `ARCHITECTURE.md` as a hardening item.

---

### 4.4 Module 3 — Tender Tracking & Financial (`/tenders`)

**Purpose:** log every tender transaction filed for a client and track payment status.

**Admin sub-workflow (`/admin/tender-departments`):**
- Manage master `tender_departments` list. (Renamed from "Tender Names": the
  list always held the department a tender is filed with, and the old label made
  the tender form read wrong.)
- Seed values: PMC, Civil-Works, Govt-Supply.
- Fields: `name` (unique), `is_active` (boolean).

**Employee sub-workflow — form fields:**
1. Client — picked by **contact name or company name**; two searchable fields,
   one value. Choosing in either fills the other.
2. Tender Department (searchable select — admin-managed)
3. Quantity (integer, > 0)
4. Price (decimal, ≥ 0, 2 decimal places, `numeric(12,2)`)
5. **Total Amount** — derived. Never accepted from the client. Postgres generated column: `total_amount = quantity * price`, stored as `numeric(14,2)`. Frontend displays a read-only auto-updating field in the form for UX.
6. Status — enum `Pending | Partially Paid | Paid`, defaults to `Pending`.
7. **Amount Paid So Far** — shown *only* when the status is `Partially Paid`.
   Must be greater than zero and less than the total. For `Paid` the server
   derives it as the full total, so there is nothing to type.
8. **Payment Mode** — `Cash | Online`. Shown, and required, whenever money has
   changed hands: both `Paid` and `Partially Paid`.
9. **Remaining Amount** — derived, `total_amount - paid_amount`. A second
   Postgres generated column.

**UI:**
- Table columns, in order: Date, Added/Updated By, Client Name, Company Name,
  Tender Department, Quantity, Price, Total Amount, Paid Amount, Remaining
  Amount, Status (coloured pill, with the payment mode beneath), actions. All
  money right-aligned and currency-formatted.
- Search matches the client's contact name, their company name, or the
  department.
- **KPI strip above the table is admin-only** — see §3.3. Which cards appear
  follows the active filter: Total Outstanding, Partially Paid Value, Total Paid
  Value.
- Filter bar: searchable Client dropdown, Status segmented control
  (All / Pending / Partially Paid / Paid), and a **From / To date range**.
  Dates are IST calendar days and both ends are inclusive.
- **No row-level "mark paid" quick action.** Marking a tender paid now requires
  a payment mode, so it goes through the form.

**Calculation formulas:** `total_amount = quantity * price` and
`remaining_amount = total_amount - paid_amount`. Both computed and stored by
Postgres via `GENERATED ALWAYS AS ... STORED`.

**Outstanding vs. pending.** "Total Outstanding" sums `remaining_amount` over
`Pending` *and* `Partially Paid` rows — what is genuinely still owed. It is not
the sum of those rows' contract values, which would over-report every partly
settled tender.

---

### 4.5 Module 4 — DSC Key Management (`/dsc`)

**Purpose:** track the physical location of client USB security keys stored in office drawers/boxes, so any employee can locate a key even if the person who logged it is unavailable.

**Fields:**
| Field | Type | Rules |
|---|---|---|
| `client_id` | uuid FK | required |
| `key_status` | enum | `Key Created` (default), `Key Issued`, `Key Returned`. `Key Lost` was retired — see `DATABASE_SCHEMA.md` §7 |
| `storage_location_notes` | text | optional, free text ("Drawer 3 / Box B") |
| `created_by` | uuid FK to users | server-set from JWT; re-set to whoever last edited the row |
| `created_at` | timestamptz | server-set, immutable |
| `updated_at` | timestamptz | server-set by trigger; what the table's Date column shows |

**Issuance capture.** Setting a key to `Key Issued` **requires** the name and
phone number of the person taking it — a key out of the office with no record of
who has it is the failure this module exists to prevent. The same two fields are
optional on `Key Returned`. Phone numbers follow the app-wide Indian-mobile rule
(ten digits, first digit 6-9).

**History.** Every key carries an append-only trail in `dsc_key_events`:
creation, each issuance (with who took it and their number), and each return.
Selecting a row in the table opens it. Re-issuing a key to a *different* person
records a fresh event even though the status does not change.

**Row shading.** A row whose status is `Key Issued` is tinted red across its full
width, not just in its status pill: a key that has left the office is the one
thing worth spotting from across the room.

**UI:**
- Framed as a shared/global dashboard. Subtitle under page title: "Visible to all employees — find any client's key at a glance."
- Table columns: Client, Key Status (colored pill), Storage Location Notes, Created By, Created At, actions.
- Storage Location Notes column is prominent — it's the whole point of the module.
- Filter by client, filter by key status.
- "+ Log Key" opens a drawer with the fields above.

---

### 4.6 Dashboard (`/dashboard`)

Landing page after login. Same for both roles.

- Metric cards: Total Active Clients, Pending Tenders (count), DSC Keys in
  Office (count where status is `Key Created` or `Key Returned`), and — **for
  admins only** — Total Tender Value (Paid, currency). Employees see three
  cards; the value is withheld by the API, not merely hidden in the browser.
- Two side-by-side panels: Recent Tenders (last 5 rows), Recent Client Onboarding (last 5 rows).

---

## 5. Non-Functional Requirements

- **Timezone:** all timestamps stored as `timestamptz` (UTC). Frontend renders in Asia/Kolkata (`Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata' })`).
- **Pagination:** all list endpoints support `?page=&page_size=` from day one. Default page size 25, max 100. **Exception:** the two admin-managed master lists (`GET /api/portals`, `GET /api/tender-departments`) return a plain array — they're bounded dropdown sources consumed whole by the searchable dropdowns, so paging them would only complicate both sides. See `API_CONTRACT.md` §4.
- **Currency:** rupees, displayed as `₹1,25,000.00` (Indian grouping). Use `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
- **Password policy for user accounts:** minimum 8 chars, at least one letter and one number. Enforced by Pydantic validator on `POST /api/admin/users`.
- **Response times:** internal tool, low traffic. No specific latency targets beyond "feels snappy" — sub-500ms for reads on the free Postgres tier is fine.
- **Concurrent users:** design for ~10-20 concurrent users. Vercel serverless comfortably handles this.
- **Browsers:** modern evergreen only — latest Chrome, Firefox, Edge, Safari. No IE, no legacy support.

---

## 6. Explicitly Out of Scope (for this prototype)

- Public marketing pages, landing pages, SEO.
- Password reset via email (Admins can manually reset a user's password by re-creating credentials for now).
- Email/SMS notifications.
- File uploads / document storage for tender PDFs.
- Audit log UI (the `created_by` / `created_at` fields exist on every table but there's no dedicated audit trail viewer yet).
- Multi-tenancy — this is a single-organization tool.
- Mobile app / responsive polish beyond "usable on a tablet."
- 2FA / MFA on login.
- Portal-credential-at-rest encryption (flagged for follow-up).

---

## 7. Success Criteria for Prototype

The prototype is "done" when a developer can:

1. Bootstrap the first Admin via the CLI script.
2. Log in as Admin, create a Portal, create a Tender Department, onboard an Employee.
3. Log out, log back in as the Employee, onboard a Client, save a portal credential for that Client, log a tender, log a DSC key.
4. All CRUD operations respect the permission matrix in §3.3.
5. All list endpoints paginate. All search/filter inputs work.
6. Deployed successfully to Vercel with both projects (backend + frontend) live and talking to each other over HTTPS.

UI polish, empty states, loading skeletons, error toasts, and visual design come in a follow-up pass.
