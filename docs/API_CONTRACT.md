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

Resource-specific `409` codes are used in place of the generic `CONFLICT` so the frontend can attach an error to the right field: `EMAIL_EXISTS` (users, clients), `PORTAL_EXISTS`, `TENDER_NAME_EXISTS`.

---

## 1. Auth

### `POST /api/auth/login`

Public.

**Request:**
```json
{ "email": "user@example.com", "password": "plaintext" }
```

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
      "email": "asha@example.com",
      "role": "employee"
    }
  }
}
```

**Errors:** `401 INVALID_CREDENTIALS`, `422 VALIDATION_ERROR`, `403 ACCOUNT_INACTIVE`.

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
  "data": { "id": "uuid", "full_name": "Asha Patil", "email": "asha@example.com", "role": "employee", "is_active": true }
}
```

---

## 2. Admin — User Management

All endpoints in this section require role `admin`. Non-admin → `403 FORBIDDEN`.

### `GET /api/admin/users`

Query params: `page`, `page_size`, `search` (matches full_name / email), `role` (optional filter).

**Success 200:** paginated list of user objects (id, full_name, email, role, is_active, created_at).

---

### `POST /api/admin/users`

**Request:**
```json
{
  "full_name": "Asha Patil",
  "email": "asha@company.com",
  "password": "TempPass123!",
  "role": "employee"
}
```

**Success 201:**
```json
{ "success": true, "data": { "id": "uuid", "full_name": "...", "email": "...", "role": "employee", "is_active": true, "created_at": "..." } }
```

**Errors:** `409 EMAIL_EXISTS`, `422 VALIDATION_ERROR` (password policy: min 8 chars, at least one letter and one number).

---

### `PATCH /api/admin/users/:id`

**Request (any subset):** `{ "full_name": "...", "role": "admin", "is_active": false, "password": "NewPass123!" }`

**Success 200:** updated user object.

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
  "contact_number": "+91 98765 43210",
  "email": "rohan@mehta.com",
  "created_by": { "id": "uuid", "full_name": "Asha Patil" },
  "created_at": "2026-08-28T10:15:00Z"
}
```

---

### `POST /api/clients`

**Request:**
```json
{
  "contact_person_name": "Rohan Mehta",
  "company_name": "Mehta Constructions",
  "contact_number": "+91 98765 43210",
  "email": "rohan@mehta.com"
}
```

**Success 201:** the created client object (as above).

**Errors:** `409 EMAIL_EXISTS`, `422 VALIDATION_ERROR`.

---

### `GET /api/clients/:id`

**Success 200:** single client object.
**Errors:** `404 NOT_FOUND`.

---

### `PATCH /api/clients/:id`

Owner or admin only. Any subset of the 4 client fields.
**Errors:** `403 FORBIDDEN`, `404 NOT_FOUND`, `409 EMAIL_EXISTS`.

---

### `DELETE /api/clients/:id`

Owner or admin. Cascades to credentials, tenders, and DSC keys (see DB schema).

**Success 200:** `{ "success": true, "data": { "id": "uuid", "deleted": true } }`

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

Deactivating (`is_active: false`) removes a portal from `?active_only=true` results but leaves it resolvable by id, so existing `credentials` rows that reference it keep working. Portals are never hard-deleted (`DATABASE_SCHEMA.md` §2).

---

## 5. Credentials

### `GET /api/credentials`

Authenticated (any role).

Query params: `page`, `page_size`, `client_id` (filter), `portal_id` (filter), `search` (matches client company_name or portal name), `reveal` (bool, default false).

By default, `password` is returned as `"••••••"`. When `?reveal=true`, the actual password is returned. (Simple approach for prototype. Harden later if audit is needed.)

Each item:
```json
{
  "id": "uuid",
  "client": { "id": "uuid", "company_name": "..." },
  "portal": { "id": "uuid", "name": "..." },
  "login_identifier": "rohan.mehta",
  "password": "••••••",
  "created_by": { "id": "uuid", "full_name": "..." },
  "created_at": "..."
}
```

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

Owner or admin. Any subset of the writable fields.

---

### `DELETE /api/credentials/:id`

Owner or admin.

---

## 6. Tender Names (Admin-managed master list)

Identical in shape and behavior to Portals above — same non-paginated array response, same admin-only writes, same deactivate-don't-delete rule.

### `GET /api/tender-names`

Authenticated (any role). Query params: `active_only` (bool, default false).

**Not paginated**, same rationale as Portals.

**Success 200:**
```json
{ "success": true, "data": [ { "id": "uuid", "name": "Civil-Works", "is_active": true, "created_at": "..." } ] }
```

Ordered by `name`. Seeded with `PMC`, `Civil-Works`, `Govt-Supply` by the table-creation migration (`DATABASE_SCHEMA.md` §6).

### `POST /api/tender-names`

Admin only. **Request:** `{ "name": "PWD-Roads" }`
**Success 201:** created tender name.
**Errors:** `403 FORBIDDEN`, `409 TENDER_NAME_EXISTS`, `422 VALIDATION_ERROR`.

### `PATCH /api/tender-names/:id`

Admin only. **Request:** `{ "name"?, "is_active"? }`
**Success 200:** updated tender name.
**Errors:** `403 FORBIDDEN`, `404 NOT_FOUND`, `409 TENDER_NAME_EXISTS`.

---

## 7. Tenders

### `GET /api/tenders`

Authenticated.

Query params: `page`, `page_size`, `client_id`, `status` (`Paid` | `Pending`), `search`.

Each item:
```json
{
  "id": "uuid",
  "client": { "id": "uuid", "company_name": "..." },
  "tender_name": { "id": "uuid", "name": "Civil-Works" },
  "quantity": 10,
  "price": "2500.00",
  "total_amount": "25000.00",
  "status": "Pending",
  "created_by": { "id": "uuid", "full_name": "..." },
  "created_at": "..."
}
```

(Note: `price` and `total_amount` returned as strings to preserve decimal precision across JSON — frontend parses to number for display.)

---

### `POST /api/tenders`

**Request:**
```json
{
  "client_id": "uuid",
  "tender_name_id": "uuid",
  "quantity": 10,
  "price": "2500.00",
  "status": "Pending"
}
```

`total_amount` is **not accepted** in the request — computed by Postgres.

**Success 201:** created tender including computed `total_amount`.

**Errors:** `404 CLIENT_NOT_FOUND`, `404 TENDER_NAME_NOT_FOUND`, `422 VALIDATION_ERROR` (quantity <= 0, price < 0).

---

### `PATCH /api/tenders/:id`

Owner or admin. Common use: `{ "status": "Paid" }`. Also accepts `quantity`, `price` — `total_amount` recomputes automatically.

---

### `DELETE /api/tenders/:id`

Owner or admin.

---

## 8. DSC Keys

### `GET /api/dsc`

Authenticated (any role — global dashboard).

Query params: `page`, `page_size`, `client_id`, `status`, `search`.

Each item:
```json
{
  "id": "uuid",
  "client": { "id": "uuid", "company_name": "..." },
  "key_status": "Key Created",
  "storage_location_notes": "Drawer 3 / Box B",
  "created_by": { "id": "uuid", "full_name": "..." },
  "created_at": "..."
}
```

---

### `POST /api/dsc`

**Request:**
```json
{
  "client_id": "uuid",
  "key_status": "Key Created",
  "storage_location_notes": "Drawer 3 / Box B"
}
```

**Success 201:** created DSC key entry.

---

### `PATCH /api/dsc/:id`

Owner or admin. Typical: update `key_status` or `storage_location_notes`.

---

### `DELETE /api/dsc/:id`

Owner or admin.

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

---

## 10. Health

### `GET /api/health`

Public. Used for uptime checks.

**Success 200:** `{ "success": true, "data": { "status": "ok", "timestamp": "..." } }`
