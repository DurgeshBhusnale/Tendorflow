# Product Requirements Document — Tender Filling Business Internal Tool

**Status:** v2 (updated for Python + React stack, monorepo, Vercel hosting)
**Audience:** Developer(s) and Claude Code
**Scope:** Working prototype covering 5 modules. UI polish deferred; focus on correct behavior.

---

## 1. Purpose

An internal, authentication-gated web application for a tender-filling business. Employees onboard clients, store portal login credentials, log tender transactions with pricing and status, and track the physical location of client DSC (Digital Signature Certificate) USB keys stored in the office. Admins additionally manage the master dropdown lists (Portals, Tender Names) and onboard new user accounts.

Nothing about this app is public. There is no landing page, no self-signup, no SEO, no public API. Every route requires a valid session.

---

## 2. Personas

| Persona | Description | Primary goals |
|---|---|---|
| **Admin** | Business owner / senior staff. | Manage master dropdown lists (Portals, Tender Names). Onboard new user accounts (Admin or Employee). View and edit all records across the app. |
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
| Edit / delete records **they created** | ✅ | ✅ |
| Edit / delete records **created by others** | ✅ | 🚫 |
| Manage master **Portals** list | ✅ | 🚫 (read-only) |
| Manage master **Tender Names** list | ✅ | 🚫 (read-only) |
| Onboard new user accounts | ✅ | 🚫 |

Ownership is enforced in the service layer, not by database-level RLS (we're not using Supabase Auth, so `auth.uid()` is not available at the DB layer). The pattern is:

```python
def update_client(client_id: UUID, payload: ClientUpdate, current_user: User):
    client = repo.get_client(client_id)
    if client.created_by != current_user.id and current_user.role != "admin":
        raise ForbiddenError("You can only edit clients you created")
    ...
```

---

## 4. Modules

### 4.1 Module 0 — Authentication & User Management

**Login screen (`/`)**
- Email + password inputs, "Sign In" button.
- Inline error state on invalid credentials.
- Small helper text: "Access is provided by your administrator."

**Admin user management (`/admin/users`)**
- Table of all accounts: Name, Email, Role, Date Added.
- "Onboard User" action opens a form: Full Name, Email, Temporary Password, Role (Admin / Employee).
- Admins can toggle a user active/inactive (soft disable) but cannot delete users, since audit trails via `created_by` foreign keys would break.

**Bootstrap:** the very first Admin is created via a one-off Python script (`app/scripts/create_admin.py`) since there's no seed Admin to invite one through the UI. Script prompts for email/password/name and inserts directly.

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

**Admin sub-workflow (`/admin/tender-names`):**
- Manage master `tender_names` list.
- Seed values: PMC, Civil-Works, Govt-Supply.
- Fields: `name` (unique), `is_active` (boolean).

**Employee sub-workflow — form fields:**
1. Client (select)
2. Tender Name (select — admin-managed)
3. Quantity (integer, > 0)
4. Price (decimal, ≥ 0, 2 decimal places, `numeric(12,2)`)
5. **Total Amount** — derived. Never accepted from the client. Postgres generated column: `total_amount = quantity * price`, stored as `numeric(14,2)`. Frontend displays a read-only auto-updating field in the form for UX.
6. Status — enum `Paid | Pending`, defaults to `Pending`.

**UI:**
- Table columns: Client, Tender Name, Quantity, Price, Total Amount (right-aligned, currency-formatted), Status (colored pill), Added By, Date, actions.
- Summary strip above the table: "Total Pending Value" and "Total Paid Value".
- Filter bar: Client dropdown, Status segmented control (All / Paid / Pending).
- Row-level quick action to flip Status from Pending → Paid.

**Calculation formula:** `total_amount = quantity * price`. Computed and stored by Postgres via `GENERATED ALWAYS AS ... STORED`.

---

### 4.5 Module 4 — DSC Key Management (`/dsc`)

**Purpose:** track the physical location of client USB security keys stored in office drawers/boxes, so any employee can locate a key even if the person who logged it is unavailable.

**Fields:**
| Field | Type | Rules |
|---|---|---|
| `client_id` | uuid FK | required |
| `key_status` | enum | `Key Created` (default), `Key Issued`, `Key Returned`, `Key Lost` — extended beyond spec's single default because the actual workflow needs lifecycle states |
| `storage_location_notes` | text | optional, free text ("Drawer 3 / Box B") |
| `created_by` | uuid FK to users | server-set from JWT, never editable |
| `created_at` | timestamptz | server-set, immutable |

**UI:**
- Framed as a shared/global dashboard. Subtitle under page title: "Visible to all employees — find any client's key at a glance."
- Table columns: Client, Key Status (colored pill), Storage Location Notes, Created By, Created At, actions.
- Storage Location Notes column is prominent — it's the whole point of the module.
- Filter by client, filter by key status.
- "+ Log Key" opens a drawer with the fields above.

---

### 4.6 Dashboard (`/dashboard`)

Landing page after login. Same for both roles.

- 4 metric cards: Total Active Clients, Pending Tenders (count), Total Tender Value (Paid, currency), DSC Keys in Office (count where status is `Key Created` or `Key Returned`).
- Two side-by-side panels: Recent Tenders (last 5 rows), Recent Client Onboarding (last 5 rows).

---

## 5. Non-Functional Requirements

- **Timezone:** all timestamps stored as `timestamptz` (UTC). Frontend renders in Asia/Kolkata (`Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata' })`).
- **Pagination:** all list endpoints support `?page=&page_size=` from day one. Default page size 25, max 100. **Exception:** the two admin-managed master lists (`GET /api/portals`, `GET /api/tender-names`) return a plain array — they're bounded dropdown sources consumed whole by select inputs, so paging them would only complicate both sides. See `API_CONTRACT.md` §4.
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
2. Log in as Admin, create a Portal, create a Tender Name, onboard an Employee.
3. Log out, log back in as the Employee, onboard a Client, save a portal credential for that Client, log a tender, log a DSC key.
4. All CRUD operations respect the permission matrix in §3.3.
5. All list endpoints paginate. All search/filter inputs work.
6. Deployed successfully to Vercel with both projects (backend + frontend) live and talking to each other over HTTPS.

UI polish, empty states, loading skeletons, error toasts, and visual design come in a follow-up pass.
