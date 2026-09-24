# API Contract

**Base URL:** `https://<backend-vercel-url>` in production, `http://localhost:8000` in development.

**All endpoints below are prefixed with `/api`.**

---

## Conventions

### Authentication

Every endpoint except `POST /api/auth/login`, `POST /api/auth/refresh`, and `GET /api/health` requires:

```
Authorization: Bearer <access_token>
```

Missing or invalid → `401 UNAUTHENTICATED`. Expired → `401 TOKEN_EXPIRED` (frontend attempts refresh on this specific code).

### Response Envelope

**Success:**
```json
{ "success": true, "data": <payload> }
```

**Error:**
```json
{ "success": false, "error": { "code": "STRING_CODE", "message": "Human readable message" } }
```

**Paginated list response:**
```json
{
  "success": true,
  "data": {
    "items": [ ... ],
    "total_count": 42,
    "page": 1,
    "page_size": 25
  }
}
```

### Common Query Params (list endpoints)

- `page` (int, default 1)
- `page_size` (int, default 25, max 100)
- `search` (string, endpoint-specific fields)

### Server-Set Fields

`created_by` and `created_at` are **never** accepted in request bodies. They are set from the authenticated user and the current timestamp.

`created_by` is **re-set to the acting user on every successful update** across
clients, credentials, tenders and DSC keys. It therefore names *the last person
to touch the row*, not its original author, and the UI labels the column
"Added/Updated By" (Clients: "Onboarded/Updated By"). Pair it with `updated_at`,
which every one of those tables maintains through a trigger.

### Permission Model

Two roles, and — since every module became open-edit — no ownership axis:

| Operation | Who |
|---|---|
| Read anything | Any signed-in user |
| Create anything | Any signed-in user |
| Update a client / credential / tender / DSC key / EMD | **Any signed-in user** |
| Delete a client / credential / tender / DSC key / EMD | **Admin only** |
| Master lists (portals, tender departments), user management, tender summary | Admin only |
| **Expenses — every operation, reads included** | **Admin only** |

Deletion is admin-only precisely *because* editing is open: with `created_by`
tracking the last editor, an ownership check on delete would hand deletion
rights to whoever happened to edit a row most recently. Deleting a client also
cascades to their credentials, tenders and DSC keys.

### Common Error Codes

| HTTP | Code | Meaning |
|---|---|---|
| 401 | `UNAUTHENTICATED` | No token or invalid signature |
| 401 | `TOKEN_EXPIRED` | Access token past expiry; frontend should refresh |
| 403 | `FORBIDDEN` | Authenticated but role/ownership check failed |
| 404 | `NOT_FOUND` | Record or referenced FK doesn't exist |
| 409 | `CONFLICT` | Unique constraint violation |
| 422 | `VALIDATION_ERROR` | Request body failed schema validation |
| 500 | `INTERNAL_ERROR` | Unhandled server error |

Resource-specific `409` codes are used in place of the generic `CONFLICT` so the frontend can attach an error to the right field: `EMAIL_EXISTS` (users, clients), `USERNAME_EXISTS`, `PORTAL_EXISTS`, `TENDER_DEPARTMENT_EXISTS`, `PORTAL_IN_USE`, `TENDER_DEPARTMENT_IN_USE`.

---

## 1. Auth

### `POST /api/auth/login`

Public.

Sign-in is by **username**, not email. Email is an **optional** contact address
on every account — unique when present, and never a credential — so `email` can
be `null` anywhere a user appears.

**Request:**
```json
{ "username": "asha.patil", "password": "plaintext" }
```

Usernames are matched case-insensitively (stored and compared lowercased).

**Success 200:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "user": {
      "id": "uuid",
      "full_name": "Asha Patil",
      "username": "asha.patil",
      "email": "asha@example.com",
      "role": "employee"
    }
  }
}
```

**Errors:** `401 INVALID_CREDENTIALS`, `422 VALIDATION_ERROR`, `403 ACCOUNT_INACTIVE`.

An unknown username and a wrong password both return `401 INVALID_CREDENTIALS`
with the same message, so the endpoint cannot be used to enumerate accounts.

---

### `POST /api/auth/refresh`

Public.

**Request:** `{ "refresh_token": "eyJ..." }`

**Success 200:**
```json
{ "success": true, "data": { "access_token": "eyJ..." } }
```

**Errors:** `401 INVALID_REFRESH_TOKEN`, `401 TOKEN_EXPIRED`.

---

### `POST /api/auth/logout`

Authenticated. Currently a no-op (stateless JWT), reserved for future blacklisting.

**Success 200:** `{ "success": true, "data": { "logged_out": true } }`

---

### `GET /api/auth/me`

Authenticated. Returns the current user (for hydrating frontend auth context on reload).

**Success 200:**
```json
{
  "success": true,
  "data": { "id": "uuid", "full_name": "Asha Patil", "username": "asha.patil", "email": "asha@example.com", "role": "employee", "is_active": true }
}
```

---

## 2. Admin — User Management

All endpoints in this section require role `admin`. Non-admin → `403 FORBIDDEN`.

### `GET /api/admin/users`

Query params: `page`, `page_size`, `search` (matches full_name / username / email), `role` (optional filter).

**Success 200:** paginated list of user objects (id, full_name, username, email, role, is_active, created_at). `email` is `null` on accounts that have none.

---

### `POST /api/admin/users`

**Request:**
```json
{
  "full_name": "Asha Patil",
  "username": "asha.patil",
  "email": "asha@company.com",
  "password": "TempPass123!",
  "role": "employee"
}
```

`username` is **required**, normalized to lowercase, and must be 3-30 characters
of `a-z`, `0-9`, `.`, `_` or `-`.

`email` is **optional** and may be omitted, `null`, or an empty string — all
three store no email and read back as `null`. The column stays unique, but
Postgres treats NULLs as distinct, so any number of accounts may have none.

**Success 201:**
```json
{ "success": true, "data": { "id": "uuid", "full_name": "...", "username": "...", "email": "...", "role": "employee", "is_active": true, "created_at": "..." } }
```

**Errors:** `409 USERNAME_EXISTS`, `409 EMAIL_EXISTS`, `422 VALIDATION_ERROR` (password policy: min 8 chars, at least one letter and one number; or username format).

---

### `PATCH /api/admin/users/:id`

**Request (any subset):** `{ "full_name": "...", "username": "asha.p", "email": "asha@company.com", "role": "admin", "is_active": false, "password": "NewPass123!" }`

Every field of an account is editable by an admin, `username` included. Changing
it changes what that person signs in with, so the admin is expected to tell
them; their existing sessions are unaffected, because tokens carry the user id
rather than the username. Sending `email: null` (or `""`) clears the stored
address. `password` is only changed when present — omit it to leave it alone.

**Success 200:** updated user object.

**Errors:** `404 NOT_FOUND`, `409 USERNAME_EXISTS`, `409 EMAIL_EXISTS`,
`422 LAST_ADMIN` (deactivating or demoting the only active admin),
`422 VALIDATION_ERROR`.

---

### `DELETE /api/admin/users/:id`

Admin only. A **hard delete**, not a deactivation.

Every `created_by` foreign key is `ON DELETE SET NULL`, so the person's clients,
tenders, credentials and DSC keys survive the delete and report `created_by:
null` afterwards. Use `PATCH ... { "is_active": false }` instead when the
attribution should be preserved.

**Success 200:** `{ "success": true, "data": { "id": "uuid", "deleted": true } }`

**Errors:**

| HTTP | Code | Meaning |
|---|---|---|
| 404 | `NOT_FOUND` | No such user. |
| 422 | `CANNOT_DELETE_SELF` | An admin cannot delete their own account. |
| 422 | `LAST_ADMIN` | Would leave the workspace with no active admin. |

---

## 3. Clients

### `GET /api/clients`

Authenticated (any role).

Query params: `page`, `page_size`, `search` (matches contact_person_name / company_name / email).

**Success 200:** paginated list.

Each item:
```json
{
  "id": "uuid",
  "contact_person_name": "Rohan Mehta",
  "company_name": "Mehta Constructions",
  "contact_number": "9876543210",
  "email": "rohan@mehta.com",
  "bank_details": "HDFC Bank, Pune Camp
A/C 50100123456
IFSC HDFC0000123",
  "created_by": { "id": "uuid", "full_name": "Asha Patil" },
  "created_at": "2026-08-28T10:15:00Z",
  "updated_at": "2026-09-02T11:40:00Z"
}
```

`created_by` / `updated_at` describe the **most recent edit** — see *Server-Set
Fields*.

---

### `POST /api/clients`

**Request:**
```json
{
  "contact_person_name": "Rohan Mehta",
  "company_name": "Mehta Constructions",
  "contact_number": "9876543210",
  "email": "rohan@mehta.com",
  "bank_details": "HDFC Bank, Pune Camp
A/C 50100123456
IFSC HDFC0000123"
}
```

`bank_details` is **optional** free text, at most 500 characters, and may
contain newlines — it is whatever the client actually sends: an account
number and IFSC, a UPI handle, or a sentence naming the branch. Omitted,
`null` or blank all store nothing and read back as `null`. Any signed-in
user may set or change it; it is not an admin field.

**`contact_number` must be an Indian mobile number**: ten digits beginning 6, 7,
8 or 9. A leading `+91`, `91` or `0`, and any spaces, dashes or brackets, are
stripped before validation, and the **normalized ten-digit form is what gets
stored and returned** — so `"+91 98765-43210"` comes back as `"9876543210"`.
The same rule applies to every phone field in the API.

**Success 201:** the created client object (as above).

**Errors:** `409 EMAIL_EXISTS`, `422 VALIDATION_ERROR`.

---

### `GET /api/clients/:id`

**Success 200:** single client object.
**Errors:** `404 NOT_FOUND`.

---

### `PATCH /api/clients/:id`

**Any signed-in user.** Any subset of the 5 client fields. On success
`created_by` becomes the acting user and `updated_at` moves to now.

**Errors:** `404 NOT_FOUND`, `409 EMAIL_EXISTS`, `422 VALIDATION_ERROR`.

---

### `DELETE /api/clients/:id`

**Admin only.** Cascades to credentials, tenders, and DSC keys (see DB schema).

**Success 200:** `{ "success": true, "data": { "id": "uuid", "deleted": true } }`
**Errors:** `403 FORBIDDEN`, `404 NOT_FOUND`.

---

## 4. Portals (Admin-managed master list)

### `GET /api/portals`

Authenticated (any role). Query params: `active_only` (bool, default false).

**Not paginated** — master lists are bounded dropdown sources, so `data` is a plain array rather than the `{ items, total_count, page, page_size }` envelope used by the record modules. This is the documented exception to PRD §5's "all list endpoints paginate."

**Success 200:**
```json
{ "success": true, "data": [ { "id": "uuid", "name": "GeM Portal", "is_active": true, "created_at": "..." } ] }
```

Results are ordered by `name`. `created_by` is stored server-side but not returned.

---

### `POST /api/portals`

Admin only.

**Request:** `{ "name": "GeM Portal" }`
**Success 201:** created portal.
**Errors:** `403 FORBIDDEN`, `409 PORTAL_EXISTS`, `422 VALIDATION_ERROR` (empty name, or over 120 chars).

---

### `PATCH /api/portals/:id`

Admin only. **Request:** `{ "name"?, "is_active"? }`
**Success 200:** updated portal.
**Errors:** `403 FORBIDDEN`, `404 NOT_FOUND`, `409 PORTAL_EXISTS`.

Deactivating (`is_active: false`) removes a portal from `?active_only=true` results but leaves it resolvable by id, so existing `credentials` rows that reference it keep working.

---

### `DELETE /api/portals/:id`

Admin only. A hard delete, and only for a portal nothing references.

A portal that any credential still uses is refused with `409 PORTAL_IN_USE` and
a message naming the count — `credentials.portal_id` is `ON DELETE RESTRICT`
(`DATABASE_SCHEMA.md` §2), and cascading would silently destroy stored logins.
Deactivating is the answer for a portal that is no longer used but has history.

**Success 200:** `{ "success": true, "data": { "id": "uuid", "deleted": true } }`
**Errors:** `403 FORBIDDEN`, `404 NOT_FOUND`, `409 PORTAL_IN_USE`.

---

## 5. Credentials

**Password visibility model.** Stored portal passwords are readable by *any* authenticated user — both roles, regardless of who created the row. This is deliberate and matches the module's purpose ("so any employee can log in to file their tenders"). Writes are open to any signed-in user too; only deletion is admin-gated.

Passwords are **never** returned by the list endpoint. Revealing one is a single-row action against `GET /api/credentials/:id?reveal=true`, so a list response can't leak every password at once. The password is stored in plaintext (see `PRD.md` §4.3 and the encryption-at-rest hardening item in `ARCHITECTURE.md` §7).

### `GET /api/credentials`

Authenticated (any role).

Query params: `page`, `page_size`, `client_id` (filter), `portal_id` (filter), `search` (matches client contact_person_name, client company_name, or portal name).

`password` is **always** `"••••••"` here — there is no list-level reveal. Use the per-row endpoint below.

Each item:
```json
{
  "id": "uuid",
  "client": { "id": "uuid", "contact_person_name": "...", "company_name": "..." },
  "portal": { "id": "uuid", "name": "..." },
  "login_identifier": "rohan.mehta",
  "password": "••••••",
  "created_by": { "id": "uuid", "full_name": "..." },
  "created_at": "...",
  "updated_at": "..."
}
```

The nested `client` object carries **both** the contact person and the company
everywhere it appears, because every table that embeds a client now shows both
and searches on both.

`created_by` / `updated_at` name the **most recent edit** — so rotating a
password moves both. That is the point: who last changed a stored password, and
when, is what the Credentials table is read for.

---

### `GET /api/credentials/:id`

Authenticated (any role). Query params: `reveal` (bool, default false).

Returns a single credential in the same shape as a list item. With `?reveal=true` the `password` field holds the real stored password; otherwise it's masked. This is what the table's click-to-reveal action calls.

**Errors:** `404 NOT_FOUND`.

---

### `POST /api/credentials`

**Request:**
```json
{
  "client_id": "uuid",
  "portal_id": "uuid",
  "login_identifier": "rohan.mehta",
  "password": "portalPassword123"
}
```

**Success 201:** created credential (password returned masked).

**Errors:** `404 CLIENT_NOT_FOUND`, `404 PORTAL_NOT_FOUND`, `422 VALIDATION_ERROR`.

---

### `PATCH /api/credentials/:id`

**Any signed-in user.** Any subset of `client_id`, `portal_id`, `login_identifier`, `password`. On success `created_by` becomes the acting user and `updated_at` moves to now.

**Success 200:** updated credential, password masked.
**Errors:** `404 NOT_FOUND`, `404 CLIENT_NOT_FOUND`, `404 PORTAL_NOT_FOUND`, `422 VALIDATION_ERROR`.

---

### `DELETE /api/credentials/:id`

**Admin only.**

**Success 200:** `{ "success": true, "data": { "id": "uuid", "deleted": true } }`
**Errors:** `403 FORBIDDEN`, `404 NOT_FOUND`.
**Errors:** `403 FORBIDDEN`, `404 NOT_FOUND`.

---

## 6. Tender Departments (Admin-managed master list)

Identical in shape and behavior to Portals above — same non-paginated array response, same admin-only writes, and the same rule that an entry in use can only be deactivated.

### `GET /api/tender-departments`

Authenticated (any role). Query params: `active_only` (bool, default false).

**Not paginated**, same rationale as Portals.

**Success 200:**
```json
{ "success": true, "data": [ { "id": "uuid", "name": "Civil-Works", "is_active": true, "created_at": "..." } ] }
```

Ordered by `name`. Seeded with `PMC`, `Civil-Works`, `Govt-Supply` by the table-creation migration (`DATABASE_SCHEMA.md` §6).

### `POST /api/tender-departments`

Admin only. **Request:** `{ "name": "PWD-Roads" }`
**Success 201:** created tender department.
**Errors:** `403 FORBIDDEN`, `409 TENDER_DEPARTMENT_EXISTS`, `422 VALIDATION_ERROR`.

### `PATCH /api/tender-departments/:id`

Admin only. **Request:** `{ "name"?, "is_active"? }`
**Success 200:** updated tender department.
**Errors:** `403 FORBIDDEN`, `404 NOT_FOUND`, `409 TENDER_DEPARTMENT_EXISTS`.

### `DELETE /api/tender-departments/:id`

Admin only, and only for a department nothing references.

A department on any logged tender is refused with `409 TENDER_DEPARTMENT_IN_USE`
and a message naming the count. `tenders.tender_department_id` is
`ON DELETE RESTRICT`: the department is part of that tender's financial record,
so it has to outlive any attempt to tidy the dropdown.

**Success 200:** `{ "success": true, "data": { "id": "uuid", "deleted": true } }`
**Errors:** `403 FORBIDDEN`, `404 NOT_FOUND`, `409 TENDER_DEPARTMENT_IN_USE`.

---

## 7. Tenders

### `GET /api/tenders`

Authenticated.

Query params:

| Param | Meaning |
|---|---|
| `page`, `page_size` | Pagination. |
| `client_id` | Restrict to one client. |
| `status` | `Pending` \| `Partially Paid` \| `Paid`. |
| `search` | Matches client contact_person_name, client company_name, or tender department name. |
| `start_date` | Inclusive lower bound, `YYYY-MM-DD`. |
| `end_date` | Inclusive upper bound, `YYYY-MM-DD`. |

**Filtering and ordering are by `tender_date`**, the calendar day the tender is
logged *for*, which is not necessarily the day someone typed it in. Both bounds
are inclusive and are compared to that date directly, with no timezone
conversion involved — `tender_date` is already a calendar day.

Neither `created_at` nor `updated_at` affects the filter or the order, so
editing a row never moves it into a different date bucket or reshuffles the
table. Rows sharing a `tender_date` fall back to `created_at` descending.

Each item:
```json
{
  "id": "uuid",
  "client": { "id": "uuid", "contact_person_name": "Rohan Mehta", "company_name": "Mehta Constructions" },
  "tender_department": { "id": "uuid", "name": "Civil-Works" },
  "quantity": 10,
  "price": "2500.00",
  "total_amount": "25000.00",
  "paid_amount": "10000.00",
  "remaining_amount": "15000.00",
  "status": "Partially Paid",
  "payment_mode": "Online",
  "created_by": { "id": "uuid", "full_name": "..." },
  "tender_date": "2026-09-20",
  "payer_name": "Suresh Patil",
  "payer_contact": "9876543210",
  "created_at": "...",
  "updated_at": "..."
}
```

`payer_name` and `payer_contact` record **who physically came in to pay**,
which changes from visit to visit and is often not the client's standing
contact. Both are optional and both are `null` when nothing was recorded —
plenty of tenders are settled with nobody walking in. A `payer_contact` that
*is* given must be a valid Indian mobile and is stored as ten digits; blank
or whitespace stores `null` rather than an empty string.

`tender_date` is a bare calendar day (`YYYY-MM-DD`), not a timestamp: it is the
business date the tender belongs to. `created_at` remains the audit timestamp
for when the row was entered, and is never client-settable (root `CLAUDE.md`
invariant 2) — which is exactly why the business date is a separate field.

(Note: `price`, `total_amount`, `paid_amount` and `remaining_amount` are returned as strings to preserve decimal precision across JSON — frontend parses to number for display.)

`total_amount` (`quantity * price`) and `remaining_amount` (`total_amount -
paid_amount`) are both Postgres generated columns. Neither is accepted in a
request body; sending either has no effect.

#### The payment model

| `status` | `payment_mode` | `paid_amount` |
|---|---|---|
| `Pending` | must be absent/null | forced to `0.00` |
| `Partially Paid` | **required** (`Cash` \| `Online`) | **required**, `> 0` and `< total_amount` |
| `Paid` | **required** (`Cash` \| `Online`) | derived by the server as `total_amount`; anything sent is ignored |

These rules are enforced in the Pydantic schema, again in the service on the
merged row for a `PATCH`, and once more by a Postgres `CHECK` constraint. A
violation returns `422` with a message written for display.

Two behaviours worth knowing:

- **Moving a tender back to `Pending` clears its payment record** — mode and
  amount are wiped rather than the request failing on the stale mode.
- **Repricing a `Paid` tender carries `paid_amount` with it**, so it stays fully
  paid. Repricing a `Partially Paid` tender *below* what has already been paid is
  rejected.

`payment_mode` is also null on tenders that were marked Paid before the field
existed; those rows predate any record of how the money arrived.

---

### `GET /api/tenders/summary`

**Admin only.** Non-admin → `403 FORBIDDEN`.

Backs the KPI strip above the tenders table (`PRD.md` §4.4). These figures are
the business's revenue and receivables, so the restriction lives on the
endpoint: hiding the cards in the UI would leave the numbers one API call away
from any employee.

Accepts the **same** filter params as `GET /api/tenders` (`client_id`, `status`,
`search`, `start_date`, `end_date`; pagination params are ignored) and describes
exactly the rows that filter selects — so the strip always agrees with the table
beneath it. Filtering to `status=Paid` therefore reports a pending value of
`"0.00"`, which is correct for the visible rows.

This is a separate endpoint rather than an extra key inside the list response, so the paginated envelope stays uniform across every list endpoint (root `CLAUDE.md` invariant 4).

**Success 200:**
```json
{
  "success": true,
  "data": {
    "total_pending_value": "12500.00",
    "total_paid_value": "25000.00",
    "total_partially_paid_value": "10000.00",
    "total_outstanding_value": "18500.00",
    "pending_count": 3,
    "paid_count": 2,
    "partially_paid_count": 1
  }
}
```

Field meanings, which are **not** interchangeable:

| Field | Definition |
|---|---|
| `total_pending_value` | Sum of `total_amount` over `Pending` rows. |
| `total_paid_value` | Sum of `total_amount` over `Paid` rows. |
| `total_partially_paid_value` | Sum of `total_amount` over `Partially Paid` rows — their full contract value, not what is owed on them. |
| `total_outstanding_value` | Sum of **`remaining_amount`** over `Pending` *and* `Partially Paid` rows. What is actually still owed. |

The distinction matters: a part-settled tender owes its balance, not its
contract value. Summing `total_amount` across the unpaid statuses — which is
what this endpoint did before partial payments existed — over-reports every
partly settled row.

Values are summed from the stored generated columns, so they can't drift from the rows.

**Errors:** `401 UNAUTHENTICATED`, `403 FORBIDDEN`.

---

### `POST /api/tenders`

**Request:**
```json
{
  "client_id": "uuid",
  "tender_department_id": "uuid",
  "quantity": 10,
  "price": "2500.00",
  "status": "Partially Paid",
  "paid_amount": "10000.00",
  "payment_mode": "Online",
  "tender_date": "2026-09-18"
}
```

`status` defaults to `Pending`, in which case `paid_amount` and `payment_mode`
are both omitted. See *The payment model* above for which combinations are
valid.

`tender_date` is optional and **defaults to today's IST calendar day** — the IST
day, not the UTC one, since the two differ between 00:00 and 05:30 IST. Send it
to log a tender for another day; a past date is the common case, and no upper
bound is enforced.

`total_amount` and `remaining_amount` are **not accepted** in the request — both
are computed by Postgres.

**Success 201:** created tender including the computed amounts.

**Errors:** `404 CLIENT_NOT_FOUND`, `404 TENDER_DEPARTMENT_NOT_FOUND`, `422 VALIDATION_ERROR` (quantity <= 0, price < 0, or a payment-model violation).

---

### `PATCH /api/tenders/:id`

**Any signed-in user.** Accepts any subset of `client_id`, `tender_department_id`, `quantity`, `price`, `status`, `paid_amount`, `payment_mode`, `tender_date`, `payer_name`, `payer_contact`.

Payment rules are re-checked against the row **as it will be after the merge**,
not against the payload alone — so `{ "status": "Paid" }` on its own fails with
`422` unless the row already carries a `payment_mode`. (There is deliberately no
one-click "mark paid" action any more: marking a tender paid requires knowing
how it was paid.)

`total_amount` and `remaining_amount` recompute automatically in Postgres and are never accepted in the body. On success `created_by` becomes the acting user and `updated_at` moves to now.

**Success 200:** updated tender.
**Errors:** `404 NOT_FOUND`, `404 CLIENT_NOT_FOUND`, `404 TENDER_DEPARTMENT_NOT_FOUND`, `422 VALIDATION_ERROR`.

---

### `GET /api/tenders/outstanding`

**Any signed-in user.** Query param: `client_id` (required).

What one client still owes, across every tender of theirs that is `Pending` or
`Partially Paid`.

**Not** admin-gated, unlike `/summary`. CH-12 withheld the *business's* revenue
from employees; a single client's balance is the number the person taking their
money needs in front of them.

**Success 200:**
```json
{ "success": true, "data": { "outstanding": "10000.00", "unpaid_count": 3 } }
```

**Errors:** `404 CLIENT_NOT_FOUND`.

---

### `POST /api/tenders/settle`

**Any signed-in user.** Records a lump sum against a client's dues and spreads
it across their unpaid tenders.

The case it exists for: a client owes money over several tenders, walks in, and
pays an amount that matches none of them.

**Request:**
```json
{
  "client_id": "uuid",
  "amount": "5000.00",
  "payment_mode": "Cash",
  "preview": false
}
```

**Allocation is oldest tender first**, by `tender_date` then `created_at`. Each
tender is settled in full until what remains cannot cover one; that tender
becomes `Partially Paid` and the rest are untouched. A tender already part-paid
is topped up before the next one is started. `Paid` tenders are never touched.

Given 3,000 + 3,000 + 4,000 all pending and a payment of 5,000: the first goes
to `Paid`, the second to `Partially Paid` at 2,000 of 3,000, the third is left
alone, and 5,000 remains outstanding.

`payment_mode` is required — money changed hands, exactly as for a tender — and
one mode covers the whole payment. It is written onto every tender the payment
touches. On success `created_by` becomes the acting user on those rows.

**`preview: true` returns the identical plan without writing anything.** The UI
shows that plan and then re-sends with `preview: false`, so what the user
confirms is produced by the code that carries it out rather than by a second
copy of the arithmetic in the browser.

**Success 200:**
```json
{
  "success": true,
  "data": {
    "preview": false,
    "amount_applied": "5000.00",
    "outstanding_before": "10000.00",
    "outstanding_after": "5000.00",
    "allocations": [
      {
        "tender_id": "uuid",
        "tender_date": "2026-09-21",
        "tender_department": "PMC",
        "total_amount": "3000.00",
        "previously_paid": "0.00",
        "applied": "3000.00",
        "new_paid_amount": "3000.00",
        "new_status": "Paid"
      }
    ]
  }
}
```

`allocations` lists only the tenders the money reached.

**Errors:**

| HTTP | Code | Meaning |
|---|---|---|
| 404 | `CLIENT_NOT_FOUND` | No such client. |
| 422 | `AMOUNT_EXCEEDS_OUTSTANDING` | More than the client owes. Refused rather than capped: the schema has nowhere to hold a credit, so the excess would be money the app could not account for. |
| 422 | `NOTHING_OUTSTANDING` | The client owes nothing. |
| 422 | `VALIDATION_ERROR` | Amount at or below zero, or a missing/unknown payment mode. |

There is no record of the payment itself — only its effect on each tender's
balance. Answering "what did they pay on the 24th" later would need a payments
ledger, which was considered and deliberately left out.

---

### `POST /api/tenders/bulk-delete`

**Admin only.** Clears a selection in one call — the case it exists for is a
client whose finished tenders are no longer worth keeping.

**Request:** `{ "ids": ["uuid", "uuid", ...] }` — between 1 and 100 ids.

**Ids, never a filter.** The server deletes exactly the rows named, so a
dropped query param cannot widen the blast radius and a row that changed
between the click and the request cannot be deleted unseen. A caller with a
larger selection sends several calls.

**Success 200:** `{ "success": true, "data": { "deleted": 20, "requested": 20 } }`

`deleted` can be lower than `requested` when an id was already gone — that is
not an error, since the caller's intent already holds. Unlike the single-row
delete, an unknown id is **not** a `404`.

**Errors:** `403 FORBIDDEN`, `422 VALIDATION_ERROR` (empty list, or over 100 ids).

It is a `POST` because the ids travel in a body, which `DELETE` is not
reliably allowed to carry.

---

### `DELETE /api/tenders/:id`

**Admin only.**

**Success 200:** `{ "success": true, "data": { "id": "uuid", "deleted": true } }`
**Errors:** `403 FORBIDDEN`, `404 NOT_FOUND`.

---

## 8. DSC Keys

### `GET /api/dsc`

Authenticated (any role — global dashboard).

Query params: `page`, `page_size`, `client_id`, `status`, `search` (matches client contact_person_name, client company_name, **or** `storage_location_notes` — locating a key by "Drawer 3" is the point of the module).

`key_status` is one of `Key Created` (default), `Key Issued`, `Key Returned`.

**`Key Lost` is retired.** It cannot be written or filtered on — a request
carrying it returns `422`. The value still exists in the Postgres enum, because
a value cannot be dropped from an enum in place without rebuilding the type, so
a row created before the change may still hold it and reads must tolerate that.

Each item:
```json
{
  "id": "uuid",
  "client": { "id": "uuid", "contact_person_name": "...", "company_name": "..." },
  "key_status": "Key Created",
  "storage_location_notes": "Drawer 3 / Box B",
  "created_by": { "id": "uuid", "full_name": "..." },
  "created_at": "...",
  "updated_at": "..."
}
```

`created_by` is `null` if the user who logged the key was later deleted, and
otherwise names whoever last edited the row.

Note that `issued_to` / `issued_phone` are **not** on the key: they describe an
issuance event, and live in the key's history (below).

---

### `GET /api/dsc/:id`

Authenticated (any role).

**Success 200:** single DSC key entry.
**Errors:** `404 NOT_FOUND`.

---

### `GET /api/dsc/:id/history`

Authenticated (any role). The key's full trail — creation, every issuance, every
return — newest first.

`dsc_keys.key_status` remains the current-state denormalization so the list
query needs no join; this endpoint is the record of *how* the key reached that
state, and who has been holding it.

**Success 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "event_type": "Issued",
      "issued_to": "Rohan Mehta",
      "issued_phone": "9876543210",
      "notes": null,
      "created_by": { "id": "uuid", "full_name": "Asha Patil" },
      "created_at": "..."
    }
  ]
}
```

`event_type` is `Created`, `Issued` or `Returned`. Keys that predate history
tracking carry a single backfilled `Created` event; keys that were already
issued at that point get no synthetic issuance, because who held them was never
recorded.

**Errors:** `404 NOT_FOUND` — an unknown key id is a 404, not an empty list.

---

### `POST /api/dsc`

**Request:**
```json
{
  "client_id": "uuid",
  "key_status": "Key Issued",
  "storage_location_notes": "Drawer 3 / Box B",
  "issued_to": "Rohan Mehta",
  "issued_phone": "9876543210"
}
```

`key_status` defaults to `Key Created`; `storage_location_notes` is optional (a key can be logged before its location is decided).

**Success 201:** created DSC key entry. A `Created` event is written at the same
time, plus an `Issued` event if the key was logged straight into someone's hands.

**Errors:** `404 CLIENT_NOT_FOUND`, `422 VALIDATION_ERROR` (unknown or retired `key_status`, or missing issuance details).

---

### `PATCH /api/dsc/:id`

**Any signed-in user.** Accepts any subset of `client_id`, `key_status`, `storage_location_notes`, `issued_to`, `issued_phone`. Typical use is advancing the key through its lifecycle, or correcting where it's stored.

#### Issuance details

| `key_status` in the request | `issued_to` / `issued_phone` |
|---|---|
| `Key Issued` | **Both required.** A key out of the office with no record of who has it is the failure this module exists to prevent. |
| `Key Returned` | Optional — captured if given. |
| `Key Created` | Rejected if supplied. |
| absent (e.g. editing storage notes) | Not applicable; no event is recorded. |

`issued_phone` follows the same Indian-mobile rule as every other phone field
and is stored as ten digits.

Setting `key_status` to `Key Issued` or `Key Returned` appends an event to the
key's history. Re-sending `Key Issued` with **different** issuance details
records a fresh event even though the status has not changed — that is a
re-issue to a new holder. Editing only the storage notes records nothing.

On success `created_by` becomes the acting user and `updated_at` moves to now.

**Success 200:** updated DSC key entry.
**Errors:** `404 NOT_FOUND`, `404 CLIENT_NOT_FOUND`, `422 VALIDATION_ERROR`.

---

### `DELETE /api/dsc/:id`

**Admin only.** The key's history goes with it (`dsc_key_events.dsc_key_id` is `ON DELETE CASCADE`).

**Success 200:** `{ "success": true, "data": { "id": "uuid", "deleted": true } }`
**Errors:** `403 FORBIDDEN`, `404 NOT_FOUND`.

---

## 9. Dashboard

### `GET /api/dashboard/summary`

Authenticated (any role).

**Success 200:**
```json
{
  "success": true,
  "data": {
    "total_active_clients": 42,
    "pending_tenders_count": 12,
    "total_paid_tender_value": "1250000.00",
    "dsc_keys_in_office": 18,
    "recent_tenders": [ /* last 5 tender items, same shape as GET /api/tenders */ ],
    "recent_clients":  [ /* last 5 client items, same shape as GET /api/clients */ ]
  }
}
```

**Not identical for both roles.** `total_paid_tender_value` is revenue and is
admin-only (CH-12): for an employee the key is present and **`null`**, and the
UI renders one fewer card. It is withheld here in the service rather than
trimmed in the browser, so hiding the card is not the only thing standing
between an employee and the figure. Every other field is the same for both
roles.

Metric definitions, so the dashboard and the module pages can't disagree:

| Field | Definition |
|---|---|
| `total_active_clients` | Count of all `clients`. "Active" means "exists": the table has no status column and deletion is a hard cascade. |
| `pending_tenders_count` | Count of tenders with `status = 'Pending'`. Same value as `pending_count` from `GET /api/tenders/summary` unfiltered. A `Partially Paid` tender counts in neither this nor the paid value — it is its own status. |
| `total_paid_tender_value` | Sum of the stored `total_amount` over tenders with `status = 'Paid'`. Same value as that endpoint's `total_paid_value`. **Null for employees.** |
| `dsc_keys_in_office` | Count of DSC keys whose `key_status` is `Key Created` **or** `Key Returned` — the two states meaning the key is physically present. `Key Issued` is excluded, as is any legacy `Key Lost` row. |

`recent_tenders` and `recent_clients` are the newest five in the same shape and order as the first page of their list endpoints, because they are produced by the same service functions — so recent tenders follow `tender_date`, and recent clients `created_at`. Both are shorter than five when fewer rows exist.

**Errors:** `401 UNAUTHENTICATED`.

---

## 10. Health

### `GET /api/health`

Public. Used for uptime checks.

**Success 200:** `{ "success": true, "data": { "status": "ok", "timestamp": "..." } }`

---

## 11. Expenses

**Admin only, in full.** Every route below — reads included — depends on
`require_admin`; a non-admin gets `403 FORBIDDEN`. This is the cost side of the
ledger whose revenue totals are already withheld from employees (§7, §9), so
the restriction lives on the endpoints rather than on the page that calls them.

(Numbered 11 rather than slotted next to Tenders so the existing section
numbers, which other docs and code comments cite, keep pointing at the same
sections.)

### `GET /api/expenses`

Query params:

| Param | Meaning |
|---|---|
| `page`, `page_size` | Pagination. |
| `status` | `Paid` \| `Pending`. |
| `search` | Matches the `details` text. |
| `start_date` | Inclusive lower bound, `YYYY-MM-DD`. |
| `end_date` | Inclusive upper bound, `YYYY-MM-DD`. |

Filtering and ordering both use `expense_date` — the day the money was spent,
which is not necessarily the day it was typed in. Both bounds are inclusive and
compared to that date directly, with no timezone conversion, exactly as for a
tender's `tender_date`. Rows sharing a date fall back to `created_at`
descending, so editing a row never reshuffles the table.

Each item:
```json
{
  "id": "uuid",
  "amount": "2500.00",
  "details": "Diesel for the office generator, two cans",
  "status": "Pending",
  "expense_date": "2026-09-22",
  "created_by": { "id": "uuid", "full_name": "Asha Patil" },
  "created_at": "...",
  "updated_at": "..."
}
```

`amount` is a string for the same decimal-precision reason as every other money
field. `details` is free text with **no length cap** and may contain newlines —
it is the record of where the money went, and truncating it would lose the one
thing that explains an old row later.

---

### `GET /api/expenses/summary`

Backs the KPI strip above the table. Accepts the **same** filter params as the
list (`status`, `search`, `start_date`, `end_date`; pagination is ignored) and
describes exactly the rows that filter selects, so the strip always agrees with
the table beneath it.

**Success 200:**
```json
{
  "success": true,
  "data": {
    "total_amount": "12500.00",
    "paid_amount": "9000.00",
    "pending_amount": "3500.00",
    "total_count": 7,
    "paid_count": 5,
    "pending_count": 2
  }
}
```

`paid_amount` and `pending_amount` split the same set, so the two always add up
to `total_amount`. Values are summed in Postgres, so they cannot drift from the
rows.

---

### `POST /api/expenses`

**Request:**
```json
{
  "amount": "2500.00",
  "details": "Diesel for the office generator, two cans",
  "status": "Pending",
  "expense_date": "2026-09-22"
}
```

`status` defaults to `Pending`. `expense_date` is optional and **defaults to
today's IST calendar day** — the IST day, not the UTC one, since the two differ
between 00:00 and 05:30 IST. Backdating is the common case and no upper bound is
enforced.

**Success 201:** the created expense.

**Errors:** `422 VALIDATION_ERROR` (amount below zero or over `numeric(12,2)`,
empty `details`, or a status outside `Paid` / `Pending`).

---

### `GET /api/expenses/:id`

**Success 200:** single expense. **Errors:** `404 NOT_FOUND`.

---

### `PATCH /api/expenses/:id`

Accepts any subset of `amount`, `details`, `status`, `expense_date`. On success
`created_by` becomes the acting user and `updated_at` moves to now.

**Success 200:** updated expense. **Errors:** `404 NOT_FOUND`, `422 VALIDATION_ERROR`.

---

### `DELETE /api/expenses/:id`

**Success 200:** `{ "success": true, "data": { "id": "uuid", "deleted": true } }`
**Errors:** `404 NOT_FOUND`.

Nothing references an expense, so the delete cascades to nothing and is refused
by nothing.

---

## 12. EMD (Earnest Money Deposits)

Money taken from a client so a tender portal's deposit can be paid online. The
business holds it until it goes back, so `status` is either `With Us` or
`Returned`.

**Open to any signed-in user** for reads and writes, like tenders — whoever
takes or returns a deposit records it. Only deletion is admin-gated. The summary
is *not* admin-only, unlike the tender summary: these are client funds held, not
the business's revenue.

**A deposit does not reference a client record.** `client_name`, `company_name`
and `contact_number` are plain text typed on the form, because a deposit often
arrives with someone not yet onboarded and the office would rather write the
name down than stop to create a client first. Three consequences, none of them
obvious later: deleting a client does **not** remove their deposits, there is no
`client_id` filter (search covers the text instead), and two spellings of the
same company are two different strings.

### `GET /api/emds`

Query params: `page`, `page_size`, `status` (`With Us` | `Returned`),
`search` (matches the typed client name, company name or contact number),
`start_date`, `end_date`.

Filtering and ordering use `emd_date` — the day the deposit was taken — with
both bounds inclusive and `created_at` breaking ties within a day.

Each item:
```json
{
  "id": "uuid",
  "client_name": "Rohan Mehta",
  "company_name": "Mehta Constructions",
  "contact_number": "9876543210",
  "amount": "5000.00",
  "status": "With Us",
  "emd_date": "2026-09-22",
  "paid_to_bank_account": "HDFC Bank, Pune Camp
A/C 50100123456
IFSC HDFC0000123",
  "created_by": { "id": "uuid", "full_name": "Asha Patil" },
  "created_at": "...",
  "updated_at": "..."
}
```

`contact_number` follows the same Indian-mobile rule as every other phone
field (§3) and is stored as bare ten digits.

`paid_to_bank_account` records **which account the deposit was paid into**. Free
text with no length cap, newlines allowed, and optional — the detail arrives in
whatever shape the bank gave it, and often after the deposit is first logged.
Blank or whitespace stores `null`.

---

### `GET /api/emds/summary`

Accepts the same filters as the list and describes exactly those rows.

**Success 200:**
```json
{
  "success": true,
  "data": {
    "total_with_us": "12500.00",
    "total_returned": "4000.00",
    "with_us_count": 3,
    "returned_count": 1
  }
}
```

`total_with_us` is what the business is holding and still owes back.

---

### `POST /api/emds`

**Request:**
```json
{
  "client_name": "Rohan Mehta",
  "company_name": "Mehta Constructions",
  "contact_number": "9876543210",
  "amount": "5000.00",
  "status": "With Us",
  "emd_date": "2026-09-22",
  "paid_to_bank_account": "HDFC Bank, Pune Camp"
}
```

`status` defaults to `With Us` — a deposit is logged because it is being held.
`emd_date` defaults to today's IST calendar day.

`client_name` and `company_name` are required; `paid_to_bank_account` is not.

**Success 201:** the created deposit.
**Errors:** `422 VALIDATION_ERROR` (empty client or company name, amount below
zero, a number that is not an Indian mobile, or a status outside the two). There
is no `CLIENT_NOT_FOUND`: nothing is looked up.

---

### `GET /api/emds/:id`

**Success 200:** single deposit. **Errors:** `404 NOT_FOUND`.

---

### `PATCH /api/emds/:id`

**Any signed-in user.** Any subset of `client_name`, `company_name`,
`contact_number`, `amount`, `status`, `emd_date`, `paid_to_bank_account` —
marking one returned is `{ "status": "Returned" }`, and a misspelled company is
just an edit. On success `created_by` becomes the acting user and `updated_at`
moves to now.

**Success 200:** updated deposit.
**Errors:** `404 NOT_FOUND`, `404 CLIENT_NOT_FOUND`, `422 VALIDATION_ERROR`.

---

### `DELETE /api/emds/:id`

**Admin only.**

**Success 200:** `{ "success": true, "data": { "id": "uuid", "deleted": true } }`
**Errors:** `403 FORBIDDEN`, `404 NOT_FOUND`.

Deleting a client no longer touches their deposits: the rows hold typed text,
not a foreign key.

---

### `POST /api/emds/bulk-delete`

**Admin only.** Identical in shape and reasoning to
`POST /api/tenders/bulk-delete` (§7): explicit ids rather than a filter, 1 to
100 per call, and an id that is already gone counts as `deleted: 0` rather than
a `404`.

**Request:** `{ "ids": ["uuid", "uuid", ...] }`
**Success 200:** `{ "success": true, "data": { "deleted": 20, "requested": 20 } }`
**Errors:** `403 FORBIDDEN`, `422 VALIDATION_ERROR` (empty list, or over 100 ids).
