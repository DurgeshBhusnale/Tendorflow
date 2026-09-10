# Manual Test Plan — TenderFlow

**Audience:** whoever is testing the app by hand, without reading the source.
**Scope:** every module in `PRD.md` §4, exercised through the UI, plus the API-only checks the UI can't reach.
**Derived from:** `PRD.md`, `API_CONTRACT.md`, `DATABASE_SCHEMA.md` and the shipped code. Where an expected result comes from a spec line, the section is cited so you can settle arguments without guessing.

---

## 0. Before You Start

### 0.1 Environment

| Piece | Where | Check |
|---|---|---|
| Backend | `http://localhost:8000` | `GET /api/health` returns `{"success":true,"data":{"status":"ok",...}}` |
| Swagger | `http://localhost:8000/docs` | Loads. Use the **Authorize** button and paste an access token for the API-only cases. |
| Frontend | `http://localhost:5173` | Login page renders |

Start commands are in `DEVELOPMENT_GUIDE.md`. Keep browser DevTools open on the **Network** tab for the whole session — several cases are about what crosses the wire, not what's on screen.

### 0.2 Test accounts you need

Four accounts. Create them before anything else (the first admin comes from `app/scripts/create_admin.py`; the rest from `/admin/users`). Every account now needs a **username** as well as an email — the username is what you sign in with.

| Alias | Role | Purpose |
|---|---|---|
| `ADMIN-1` | admin | Bootstrap admin. Master lists, user onboarding, deletion. |
| `ADMIN-2` | admin | Proves a second admin sees the same admin-only figures. |
| `EMP-1` | employee | Creates most of the test data. |
| `EMP-2` | employee | Proves an employee **can** edit `EMP-1`'s rows but **cannot** delete them, and cannot see revenue totals. |
| `EMP-3` | employee | Disposable — created solely to be deleted in the `USER` section. |

Use two browsers (or one normal + one private window) so you can be signed in as two people at once. The access token lives in memory per tab, so a private window is the clean way to hold a genuinely separate session.

### 0.3 Seed data

Do **not** delete test rows when you're done — they're inspected in Supabase afterwards.

1. As `ADMIN-1`: create portals `GeM Portal`, `eProcure`, `State Tenders`.
2. Confirm the tender departments `PMC`, `Civil-Works`, `Govt-Supply` already exist (seeded by migration — `API_CONTRACT.md` §6).
3. As `EMP-1`: onboard 3 clients.
4. As `EMP-2`: onboard 1 client (this is the row `EMP-1` must not be able to edit).

### 0.4 How to read a case

- **P** = positive (the thing should work). **N** = negative (the thing should be refused, cleanly).
- "Cleanly" means: a readable message near the relevant field or at the top of the form, the record unchanged, no blank screen, no raw stack trace, and no unhandled error in the browser console.
- Anything marked **⚠ Known gap** is behaviour I expect to be wrong or missing. Test it anyway and log what you see — these are the ones most likely to be real bugs.

---

## 1. Authentication & Session — `AUTH`

### Positive

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-AUTH-P01 | Admin sign-in | Sign in as `ADMIN-1` | Lands on `/dashboard`. Sidebar shows **Workspace** *and* **Administration** groups (Users, Portals, Tender Departments). |
| TC-AUTH-P02 | Employee sign-in | Sign in as `EMP-1` | Lands on `/dashboard`. Sidebar shows **Workspace only** — no Administration group. |
| TC-AUTH-P03 | Password reveal on login | Click the eye icon in the password field | Password becomes readable; icon flips to eye-off; clicking again re-masks. |
| TC-AUTH-P04 | Session survives reload | Sign in, navigate to `/tenders`, press F5 | Brief "Loading…", then `/tenders` renders with data. You are **not** bounced to the login page. |
| TC-AUTH-P05 | Silent token refresh | Set `JWT_ACCESS_TTL_MINUTES=1`, restart backend, sign in, wait ~90s, then click **Clients** | Page loads normally. Network tab shows a `401 TOKEN_EXPIRED`, then `POST /api/auth/refresh`, then the original request retried and succeeding. You are never sent back to login. |
| TC-AUTH-P06 | Logout | Click Sign out | Back to `/`. `localStorage.refresh_token` is gone (DevTools → Application). |
| TC-AUTH-P07 | Back button after logout | After P06, press browser Back | Redirected to `/`. No protected page flashes with real data. |
| TC-AUTH-P08 | Login page while signed in | Signed in, navigate to `http://localhost:5173/` | Redirected straight to `/dashboard`. |
| TC-AUTH-P09 | Health is public | Open `http://localhost:8000/api/health` in a fresh private window | `200`, success envelope. No auth needed (`API_CONTRACT.md` §10). |

### Negative

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-AUTH-N01 | Wrong password | Valid email, wrong password | Inline error **"Invalid email or password."** Stays on `/`. Nothing written to `localStorage`. |
| TC-AUTH-N02 | Unknown username | `nobody-at-all` + any password | **Same** message as N01, word for word. A different message here would let an attacker enumerate real accounts. |
| TC-AUTH-N02b | Signing in with an email | Enter `EMP-1`'s **email** in the Username box, with the correct password | Rejected with the same invalid-credentials message. Email is no longer a credential (`API_CONTRACT.md` §1). |
| TC-AUTH-N02c | Username case | Sign in with `EMP-1`'s username in **UPPERCASE** | Succeeds — usernames are matched case-insensitively. |
| TC-AUTH-N03 | Empty submit | Click Sign In with both fields blank | "Enter a valid email address." and "Password is required." **No network request fires.** |
| TC-AUTH-N04 | Malformed email | `asha@` + a password | "Enter a valid email address." No request fires. |
| TC-AUTH-N05 | Deactivated account | As `ADMIN-1` deactivate `EMP-2`; sign out; try to sign in as `EMP-2` | `403 ACCOUNT_INACTIVE` → **"This account has been deactivated."** Reactivate afterwards. |
| TC-AUTH-N06 | Deactivation kills a live session | Sign in as `EMP-2` in a private window. In the other browser, `ADMIN-1` deactivates `EMP-2`. In the private window, click any nav item | The request returns `401 UNAUTHENTICATED`. **⚠ Known gap:** the response interceptor only auto-recovers from `TOKEN_EXPIRED`, so a plain `UNAUTHENTICATED` surfaces as an error rather than a redirect to login. Record exactly what the user sees — a stuck page is a bug worth filing. |
| TC-AUTH-N07 | Deep link while signed out | Private window → `http://localhost:5173/clients` | Redirected to `/`. |
| TC-AUTH-N08 | Employee reaches an admin route | As `EMP-1`, type `/admin/users` in the address bar | Redirected to `/dashboard`. No flash of the user table. Repeat for `/admin/portals` and `/admin/tender-departments`. |
| TC-AUTH-N09 | Employee calls an admin endpoint | Swagger, authorized with `EMP-1`'s token → `GET /api/admin/users` | `403 FORBIDDEN`, "Admin access required." |
| TC-AUTH-N10 | Tampered token | Change one character in the access token, call `GET /api/clients` | `401 UNAUTHENTICATED`. |
| TC-AUTH-N11 | Refresh token used as access token | Send `Authorization: Bearer <refresh_token>` to `GET /api/clients` | `401 UNAUTHENTICATED` — token *type* is checked, not just the signature. |
| TC-AUTH-N12 | Access token sent to /refresh | `POST /api/auth/refresh` with an **access** token in the body | `401 INVALID_REFRESH_TOKEN`. |
| TC-AUTH-N13 | No Authorization header | `GET /api/clients` with no header | `401 UNAUTHENTICATED`, "Missing or invalid Authorization header." |
| TC-AUTH-N14 | Garbage refresh token | DevTools → set `localStorage.refresh_token = "garbage"` → reload | Ends on the login page. No crash, no infinite spinner. |
| TC-AUTH-N15 | Refresh token of a deactivated user | Sign in as `EMP-2`, deactivate them, then `POST /api/auth/refresh` with their refresh token | `401 INVALID_REFRESH_TOKEN`. Reactivate afterwards. |

---

## 2. Admin — User Management — `USER`

All cases run as `ADMIN-1` unless stated.

### Positive

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-USER-P01 | Onboard an employee | `/admin/users` → **Onboard User** → name, **username**, unique email, `TempPass123`, role Employee → Create | Drawer closes, row appears with the username shown, role `employee`, pill **Active**, Date Added in `DD MMM YYYY` (IST). |
| TC-USER-P02 | New employee can sign in | Sign out, sign in with the **username** and password from P01 | Succeeds, no admin nav. |
| TC-USER-P02b | Username is lowercased | Onboard a user typing `Asha.Patil` as the username | Stored and displayed as `asha.patil`; signing in works with either casing. |
| TC-USER-P03 | Onboard an admin | Same but role Admin | Row shows `admin`. Signing in as them shows the Administration nav group. |
| TC-USER-P04 | Deactivate | Click **Deactivate** on a user row | Pill flips to **Inactive**, button becomes **Reactivate**. Row is not removed. |
| TC-USER-P05 | Reactivate | Click **Reactivate** | Pill back to Active; that user can sign in again. |
| TC-USER-P06 | Delete a user | Create `EMP-3`, give them a client, then delete `EMP-3` and confirm | The confirmation spells out that attribution is lost and points at Deactivate as the alternative. Row disappears; `EMP-3` can no longer sign in. |
| TC-USER-P06b | Deleted user's records survive | Open the client `EMP-3` created | Still there. **Onboarded/Updated By** now reads **—**, not a crash or a blank row (`DATABASE_SCHEMA.md` §2). |
| TC-USER-P06c | No self-delete button | As `ADMIN-1`, look at your own row | No Delete button — only Deactivate. |
| TC-USER-P07 | Search & role filter (API) | Swagger: `GET /api/admin/users?search=asha`, then `?role=admin` | Filters correctly, paginated envelope. **Note:** the Users *page* has no search box — this is API-only today. |

### Negative

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-USER-N01 | Duplicate email | Onboard a user with an email that already exists | `409 EMAIL_EXISTS` → "A user with this email already exists." No second row. |
| TC-USER-N01b | Duplicate username | Onboard a user with a username that already exists | `409 USERNAME_EXISTS`. No second row. |
| TC-USER-N01c | Blank username | Leave Username empty | "Required". No request fires. |
| TC-USER-N01d | Invalid username | `a b!` | Rejected with the 3-30 character rule. |
| TC-USER-N02 | Password too short | `Ab1` | "At least 8 characters". No request fires. |
| TC-USER-N03 | Password with no digit | `passwordonly` | "Must contain a number". |
| TC-USER-N04 | Password with no letter | `12345678` | "Must contain a letter". |
| TC-USER-N05 | Server enforces the policy too | Swagger `POST /api/admin/users` with password `abc` | `422 VALIDATION_ERROR` — the rule is not client-side only (`PRD.md` §5). |
| TC-USER-N06 | Blank full name | Leave name empty | "Required". |
| TC-USER-N07 | Invalid email | `notanemail` | "Invalid email". |
| TC-USER-N08 | Employee creates a user | Swagger with `EMP-1`'s token → `POST /api/admin/users` | `403 FORBIDDEN`. |
| TC-USER-N09 | Cancel discards input | Open the drawer, type a name, Cancel, reopen | Fields empty — the form resets. |
| TC-USER-N10 | More than 25 users | Create 26+ users, load `/admin/users` | **⚠ Known gap:** the page requests page 1 with no pager, so users 26+ are unreachable in the UI. Confirm and log. |
| TC-USER-N11 | Self-delete via API | Swagger with `ADMIN-1`'s token → `DELETE /api/admin/users/{ADMIN-1's own id}` | `422 CANNOT_DELETE_SELF`. |
| TC-USER-N12 | Deleting the last admin | Deactivate `ADMIN-2` so `ADMIN-1` is the only active admin, then have `ADMIN-2`'s session (or a second admin) try to delete `ADMIN-1` | `422 LAST_ADMIN`. Also try deactivating and demoting the last admin — both refused. **Restore `ADMIN-2` afterwards.** |
| TC-USER-N13 | Employee deletes a user | Swagger with `EMP-1`'s token → `DELETE /api/admin/users/{any id}` | `403 FORBIDDEN`. |
| TC-USER-N14 | Username can't be changed | Swagger `PATCH /api/admin/users/{id}` with `{"username":"newname"}` | The username is **unchanged** — the field is not accepted (`API_CONTRACT.md` §2). |

---

## 3. Clients — `CLI`

### Positive

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-CLI-P01 | Onboard a client | As `EMP-1`: **+ Add Client** → person, company, `+91 98765 43210`, unique email → Add Client | Drawer closes. Row appears **at the top** (newest first). "Onboarded By" = EMP-1. "Total Active Clients" increments by 1. |
| TC-CLI-P02 | Phone formats accepted | Create clients with `9876543210`, `+91 98765 43210`, `98765-43210` | All accepted and all stored as **9876543210**. `022-1234567` is now **rejected** — it is not a mobile number (`API_CONTRACT.md` §3). |
| TC-CLI-P03 | Search by company | Type part of a company name | Table narrows; the pager footer count reflects matches, not the total. |
| TC-CLI-P04 | Search is case-insensitive | Search `MEHTA` for `Mehta Constructions` | Matches. |
| TC-CLI-P05 | Search by contact person and email | Search a partial contact person, then a partial email | Both match (`API_CONTRACT.md` §3). |
| TC-CLI-P06 | Edit own client | As `EMP-1`, edit a client EMP-1 created; change the company name | Saves; table shows the new value immediately. |
| TC-CLI-P06b | Edit **another employee's** client | As `EMP-2`, edit the client `EMP-1` created | **Allowed.** Saves cleanly. The **Onboarded/Updated By** column now reads `EMP-2`, and **Date** moves to today (`PRD.md` §3.3). |
| TC-CLI-P07 | Admin edits someone else's client | As `ADMIN-2`, edit the client `EMP-1` created | Allowed. Edit **and** Delete icons visible on every row for an admin; employees see Edit only. |
| TC-CLI-P08 | Delete cascades | As `EMP-1`, give a throwaway client a credential, a tender and a DSC key. Then **as `ADMIN-1`** delete the client and confirm | Client gone. Its credential, tender and DSC rows are **also gone** from their pages. Dashboard metrics drop accordingly. |
| TC-CLI-P09 | Pagination | With 26+ clients, use Next/Previous | Page 2 shows the remainder. "Page 2 of N · M records" is accurate. Previous disabled on page 1, Next on the last. |
| TC-CLI-P10 | Search resets paging | Go to page 2, then type a search | Jumps back to page 1 — no empty table from a stale page number. |

### Negative

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-CLI-N01 | Duplicate email | Add a client with an email another client already uses | `409` → **"This email is already onboarded to another client."** in the form. No row created. |
| TC-CLI-N02 | All fields blank | Submit an empty form | "Required" on person/company, "Invalid phone number", "Invalid email". No request fires. |
| TC-CLI-N03 | Phone too short | `123456` (6 chars) | "Invalid phone number". |
| TC-CLI-N04 | Phone too long | 21+ characters | "Invalid phone number". |
| TC-CLI-N05 | Phone with letters | `98765ABCDE` | "Invalid phone number". |
| TC-CLI-N06 | Over-long names | 121+ chars in Contact Person, 201+ in Company | Rejected by the form; `422` if sent via Swagger. |
| TC-CLI-N07 | Employee sees no delete button anywhere | As `EMP-1`, look at any client row, including their own | **Edit** is present on every row; **Delete** is present on none. Deletion is admin-only. |
| TC-CLI-N08 | Employee edits another's client via API | Swagger with `EMP-1`'s token → `PATCH /api/clients/{EMP-2's client}` | `200`. Open editing is intentional — a `403` here means the old ownership check survived. |
| TC-CLI-N09 | Employee deletes **any** client via API | As `EMP-1`, `DELETE` a client — their own **and** `EMP-2`'s | `403 FORBIDDEN` on both. Rows still present. |
| TC-CLI-N10 | Non-existent id | `GET /api/clients/00000000-0000-0000-0000-000000000000` | `404 NOT_FOUND`. |
| TC-CLI-N11 | Malformed id | `GET /api/clients/not-a-uuid` | `422 VALIDATION_ERROR` — not a 500. |
| TC-CLI-N12 | Bad pagination params | `?page=0`, then `?page_size=101`, then `?page_size=0` | All `422`. Max page size is 100 (`PRD.md` §5). |
| TC-CLI-N13 | Cancel the delete confirm | Click Delete, then Cancel in the browser dialog | Row remains. No request fires. |
| TC-CLI-N14 | Audit fields can't be spoofed | Swagger `POST /api/clients` with `"created_by": "<another user id>"` and `"created_at": "2020-01-01T00:00:00Z"` in the body | Both ignored. Response shows **you** as creator and now as the timestamp (root `CLAUDE.md` invariant 2). |
| TC-CLI-N15 | Email case collision | Create `rohan@mehta.com`, then try `ROHAN@MEHTA.COM` | **⚠ Known gap:** the uniqueness check is an exact match, so the second is likely **accepted**. Two clients with the same email in different case is almost certainly wrong — log it. |
| TC-CLI-N16 | Whitespace-only phone | Enter 7 spaces in Contact Number | Rejected: "Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9." (This closes the old known gap.) |
| TC-CLI-N17 | Phone normalization | Save `+91 98765-43210` | Accepted, and the table shows **9876543210** — the +91, space and dash are stripped server-side (`API_CONTRACT.md` §3). |
| TC-CLI-N18 | Landline rejected | `2212345678` | Rejected — Indian mobiles start 6-9. |
| TC-CLI-N19 | Short number rejected | `98765` | Rejected. |
| TC-CLI-N17 | Search wildcards | Search for `%`, then `_` | The search uses a `LIKE`-style match. Check whether `%` returns *every* client (a wildcard leaking through) rather than only ones containing a literal `%`. Log the behaviour. |

---

## 4. Credentials Vault — `CRED`

Read the password rules first (`API_CONTRACT.md` §5): stored passwords are readable by **any** signed-in user regardless of who saved them — that is intentional and is the whole point of the module. Writes are now open to any signed-in user too; only deletion is admin-only.

### Positive

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-CRED-P01 | Add a credential | As `EMP-1`: client, portal, login id `rohan.mehta`, password `Portal@123` → Add Credential | Row appears. Password column shows **`••••••`**, never the real value. |
| TC-CRED-P02 | Login identifier is optional | Add one leaving Username/Email/Phone blank | Saves. Column shows **—** or blank, not the string "null". |
| TC-CRED-P03 | Reveal | Click **Reveal** on a row | Shows `Portal@123`. Network tab shows exactly one call: `GET /api/credentials/{id}?reveal=true`. |
| TC-CRED-P04 | Hide | Click **Hide** | Back to `••••••`. |
| TC-CRED-P05 | The list never leaks | With DevTools open, reload `/credentials` and inspect the `GET /api/credentials` body | **Every** `password` field is `••••••`. No plaintext anywhere in the list payload, even for rows you own. |
| TC-CRED-P06 | Cross-user reveal is allowed | As `EMP-2`, reveal the password `EMP-1` saved | Works. By design, not a bug (`API_CONTRACT.md` §5). |
| TC-CRED-P07 | Filter by client | Use the "All clients" dropdown | Only that client's credentials. Pager count updates. |
| TC-CRED-P08 | Filter by portal | Use the "All portals" dropdown | Only that portal's rows. |
| TC-CRED-P09 | Combined filter + search | Set a client filter *and* type a portal name | Both applied together (AND, not OR). |
| TC-CRED-P10 | Edit own credential | As `EMP-1`, change the portal and retype the password | Saves. Revealing now shows the **new** password. |
| TC-CRED-P11 | Admin edits another's | As `ADMIN-1`, edit `EMP-1`'s credential | Allowed. |
| TC-CRED-P12 | Delete | As `ADMIN-1`, delete a credential, confirm | Row gone. Employees have no Delete button at all. |
| TC-CRED-P14 | Client picker takes either name | Open **Add Credential**. Type a contact person's name in **Client Name** | The matching client is offered; selecting it fills **Company Name** automatically. Repeat in reverse (`PRD.md` §4.4). |
| TC-CRED-P15 | Rotation moves the attribution | As `EMP-1` create a credential, then as `EMP-2` edit it and retype the password | Saves. **Added/Updated By** reads `EMP-2` and **Date** moves to today. |
| TC-CRED-P13 | Inactive portal keeps working | Deactivate `eProcure` in `/admin/portals`, return to `/credentials` | Existing rows still display "eProcure" correctly, but the Portal dropdown in the Add form no longer offers it (`API_CONTRACT.md` §4). |

### Negative

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-CRED-N01 | No client selected | Submit with the client dropdown on the placeholder | "Select a client". No request. |
| TC-CRED-N02 | No portal selected | Same for portal | "Select a portal". |
| TC-CRED-N03 | Empty password | Client + portal chosen, password blank | "Required". |
| TC-CRED-N04 | Editing forces a password retype | Edit an existing credential, change **only** the login identifier, leave the password blank, Save | **⚠ Known gap:** the password field is required and deliberately not prefilled, so this is blocked with "Required" — you cannot fix a typo in the login id without knowing and retyping the password. Confirm and log as a usability bug. |
| TC-CRED-N05 | Password over 200 chars | Paste 201 characters | Rejected (form, and `422` from the API). |
| TC-CRED-N06 | Non-existent client | Swagger `POST /api/credentials` with a random `client_id` | `404 CLIENT_NOT_FOUND`. |
| TC-CRED-N07 | Non-existent portal | Same with `portal_id` | `404 PORTAL_NOT_FOUND`. |
| TC-CRED-N08 | Employee edits another's credential | `EMP-1` → `PATCH` a credential `EMP-2` created | `200`. Open editing is intentional. |
| TC-CRED-N09 | Employee deletes any credential | `EMP-1` → `DELETE`, on their own row and on `EMP-2`'s | `403 FORBIDDEN` on both. |
| TC-CRED-N10 | Reveal without a token | `GET /api/credentials/{id}?reveal=true` with no Authorization header | `401 UNAUTHENTICATED`. A password must never be reachable unauthenticated. |
| TC-CRED-N11 | Reveal defaults to masked | `GET /api/credentials/{id}` **without** `?reveal=true` | Password comes back `••••••`. Masking is the default; revealing is the opt-in. |
| TC-CRED-N12 | Deleted client's credentials | Delete a client that has credentials | Its credential rows disappear too. No orphan row with a blank client. |

---

## 5. Master Lists — Portals & Tender Departments — `MSTR`

Both pages share one component, so run each case on **both** `/admin/portals` and `/admin/tender-departments`.

### Positive

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-MSTR-P01 | Create | As `ADMIN-1`, add `PWD-Roads` / `New Portal` | Appears in the table, status **Active**. |
| TC-MSTR-P02 | Alphabetical order | Add names out of order (`Zebra`, then `Alpha`) | List renders sorted by name, not by creation time (`API_CONTRACT.md` §4). |
| TC-MSTR-P03 | Seeded tender departments | Open `/admin/tender-departments` on a fresh DB | `PMC`, `Civil-Works`, `Govt-Supply` present (`API_CONTRACT.md` §6). |
| TC-MSTR-P04 | New entry reaches the form | Add a tender department, then open the Tender drawer | It appears in the Tender Department dropdown. |
| TC-MSTR-P05 | Deactivate hides from dropdowns | Deactivate an entry, open the relevant form | Gone from the dropdown; the row stays in the admin table with an **Inactive** pill. |
| TC-MSTR-P06 | Reactivate | Toggle it back | Reappears in the dropdown. |
| TC-MSTR-P07 | Employee read access | As `EMP-1`, Swagger `GET /api/portals` | `200` with the array. Employees read master lists, they just can't write them. |
| TC-MSTR-P08 | Not paginated | Inspect the `GET /api/portals` response | `data` is a **plain array**, not `{items,total_count,...}`. The documented exception to "everything paginates" (`API_CONTRACT.md` §4). |
| TC-MSTR-P09 | active_only filter | `GET /api/portals?active_only=true` | Inactive portals excluded. Without the param, all are returned. |

### Negative

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-MSTR-N01 | Duplicate portal name | Add `GeM Portal` twice | `409 PORTAL_EXISTS` → "A portal with this name already exists." |
| TC-MSTR-N02 | Duplicate tender department | Add `PMC` again | `409 TENDER_DEPARTMENT_EXISTS`. |
| TC-MSTR-N03 | Blank name | Submit empty | "Required". No request. |
| TC-MSTR-N04 | Name over 120 chars | Paste 121 chars | Rejected; `422` from the API. |
| TC-MSTR-N05 | Employee writes a master list | Swagger with `EMP-1`'s token → `POST /api/portals`, then `PATCH /api/portals/{id}` | `403 FORBIDDEN` on both. |
| TC-MSTR-N06 | No hard delete | Look for a delete action | There is none, by design — historic rows reference these ids (`API_CONTRACT.md` §4). |
| TC-MSTR-N07 | Patch a non-existent id | `PATCH /api/portals/{random uuid}` | `404 NOT_FOUND`. |
| TC-MSTR-N08 | Case-variant duplicate | Add `GeM Portal`, then `gem portal` | **⚠ Known gap:** the uniqueness check is exact-match, so the near-duplicate is likely accepted and both appear in the dropdown. Log it. |
| TC-MSTR-N09 | Renaming isn't possible in the UI | Try to rename an existing portal from the page | **⚠ Known gap:** the page only offers create and activate/deactivate, though `PATCH .../{id}` with `{"name": ...}` works via the API. Log the missing affordance. |

---

## 6. Tenders — `TEN`

`total_amount` (`quantity × price`) and `remaining_amount` (`total − paid`) are both Postgres generated columns. The form's figures are display-only previews; the server value is the truth (`PRD.md` §4.4).

The status enum now has **three** values, the KPI strip is **admin-only**, and the one-click *Mark Paid* action is **gone** — marking a tender paid requires a payment mode, so it goes through the form.

### Positive

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-TEN-P01 | Live total preview | Open **Log Tender**, type quantity `10`, price `2500.00` | The Total Amount panel updates to **₹25,000** as you type, before any save. |
| TC-TEN-P02 | Create | Submit the above with a client and tender department | Row appears with Total ₹25,000, Paid ₹0, Remaining ₹25,000, pill **Pending** (the default). |
| TC-TEN-P03 | Server computes the total | Compare the row's Total against `quantity × price` | Exactly equal. |
| TC-TEN-P04 | No quick action | Look at any Pending row's Actions column | Only **Edit** (and Delete for admins). The old one-click *Mark Paid* is deliberately gone. |
| TC-TEN-P04b | Mark paid via the form | Edit a Pending tender, set Status **Paid** | A **Payment Mode** field appears and is required. Pick Cash, save. Paid = Total, Remaining = ₹0, and the strip moves without a reload. |
| TC-TEN-P05 | Edit recomputes | Edit the tender, change quantity 10 → 4 | Total becomes ₹10,000. The summary strip adjusts. |
| TC-TEN-P06 | Status filter | Set the filter to **Paid** | Only paid rows. The strip's **Total Pending Value shows ₹0** — correct, because the strip describes exactly the filtered rows (`API_CONTRACT.md` §7). |
| TC-TEN-P07 | Client filter | Pick one client | Only their tenders; the strip totals only that client's value. |
| TC-TEN-P08 | Search | Search a company name, then a contact person's name, then a tender department | All three match (`API_CONTRACT.md` §7). |
| TC-TEN-P09 | Table and strip always agree | Try several filter combinations | The strip's figures always describe the full filtered set. Cross-check one combination by hand against the rows. |
| TC-TEN-P10 | Indian currency grouping | Create a tender totalling 125000 | Renders **₹1,25,000** (lakh grouping), not ₹125,000 (`PRD.md` §5). |
| TC-TEN-P11 | Paise render fully | Price `2500.50`, quantity `1` | Shows **₹2,500.50** — never `₹2,500.5`. |
| TC-TEN-P12 | Zero price allowed | Price `0`, quantity `5` | Accepted; total ₹0 (`price ≥ 0` per contract). |
| TC-TEN-P13 | Filter resets paging | Go to page 2, change the status filter | Back to page 1. |
| TC-TEN-P14 | Delete | As `ADMIN-1`, delete a tender, confirm | Row gone; strip and dashboard both drop by that amount. Employees have no Delete button. |
| TC-TEN-P15 | Column order | Look at the table header | Date, Added/Updated By, Client Name, Company Name, Tender Department, Quantity, Price, Total, Paid, Remaining, Status, Actions — in that order (`PRD.md` §4.4). |
| TC-TEN-P16 | Mobile card title | Narrow to 390px | Each card is headed by the **client's name**, with the company in the detail pairs. |
| TC-TEN-P17 | Partial payment | Edit a tender, set Status **Partially Paid** | **Amount Paid So Far** appears (it is hidden for Pending and Paid) *and* **Payment Mode**. Enter 10000 on a ₹25,000 tender, Online, save. Row shows Paid ₹10,000, Remaining ₹15,000, a **blue** Partially Paid pill with "Online" beneath. |
| TC-TEN-P18 | Outstanding is the balance, not the value | With only that one partial tender in the filter, read **Total Outstanding** | **₹15,000**, not ₹25,000. This is the arithmetic most likely to be wrong — check it by hand. |
| TC-TEN-P19 | Back to Pending clears the payment | Edit that tender, set Status **Pending**, save | Paid ₹0, Remaining ₹25,000, payment mode gone. No error about a leftover mode. |
| TC-TEN-P20 | Repricing a paid tender | On a Paid tender, change the price | Stays Paid; Paid Amount follows the new total; Remaining stays ₹0. |
| TC-TEN-P21 | Date range filter | Set **From** and **To** to today | Today's tenders only. Set **To** to yesterday: none. Both ends are inclusive IST days. |
| TC-TEN-P22 | Date filter drives the strip too | With a date range applied, compare the strip against the visible rows | They agree — the strip describes exactly the filtered set. |
| TC-TEN-P23 | Clear filters | Set several filters, click **Clear filters** | Everything resets and the list returns to page 1. |
| TC-TEN-P24 | Searchable client filter | Click the client filter and type | It filters as you type and offers an **×** to clear. |

### Negative

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-TEN-N01 | Quantity zero | `0` | "Must be greater than 0". |
| TC-TEN-N02 | Negative quantity | `-5` | "Must be greater than 0". |
| TC-TEN-N03 | Fractional quantity | `2.5` | "Whole numbers only". |
| TC-TEN-N04 | Negative price | `-100` | Rejected before submit. |
| TC-TEN-N05 | Too many decimals | `100.999` | "At most 2 decimal places". |
| TC-TEN-N06 | Non-numeric price | `abc` | Rejected, no request fires. |
| TC-TEN-N07 | Nothing selected | Submit with both pickers empty | "Select a client" and "Select a tender department". |
| TC-TEN-N08 | total_amount can't be forced | Swagger `POST /api/tenders` with `"quantity":2, "price":"100.00", "total_amount":"999999.00"` | Created with total **200.00**. The supplied value is ignored entirely (`API_CONTRACT.md` §7). |
| TC-TEN-N09 | total_amount can't be patched | `PATCH` a tender with only `{"total_amount":"1.00"}` | The total is unchanged. |
| TC-TEN-N10 | Bad client reference | `POST` with a random `client_id` | `404 CLIENT_NOT_FOUND`. |
| TC-TEN-N11 | Bad tender department reference | `POST` with a random `tender_department_id` | `404 TENDER_DEPARTMENT_NOT_FOUND`. |
| TC-TEN-N12 | Invalid status casing | `POST` with `"status":"paid"` | `422 VALIDATION_ERROR` — the enum is `Pending` / `Partially Paid` / `Paid` exactly. |
| TC-TEN-N13 | Invalid status filter | `GET /api/tenders?status=Cancelled` | `422`, not an empty 200. |
| TC-TEN-N14 | Employee edits another's tender | `EMP-1` → `PATCH` a tender `EMP-2` created | `200`. Open editing is intentional; **Added/Updated By** becomes `EMP-1`. |
| TC-TEN-N14b | Employee deletes a tender | `EMP-1` → `DELETE` any tender | `403 FORBIDDEN`. |
| TC-TEN-N18 | Paid without a mode | Swagger `PATCH` with only `{"status":"Paid"}` on a Pending tender | `422` — "Select how this tender was paid: Cash or Online." |
| TC-TEN-N19 | Partial without an amount | `POST` Partially Paid with a mode but no `paid_amount` | `422` — "Enter how much has been paid so far." |
| TC-TEN-N20 | Partial equal to the total | Partially Paid with `paid_amount` = the full total | `422` — it should be marked Paid instead. |
| TC-TEN-N21 | Partial of zero | Partially Paid with `paid_amount` `0.00` | `422`. |
| TC-TEN-N22 | Pending with a mode | `POST` Pending with `"payment_mode":"Cash"` | `422` — a pending tender has no payment mode. |
| TC-TEN-N23 | Repricing below what was paid | On a Partially Paid tender with ₹20,000 paid, drop quantity so the total falls under ₹20,000 | `422` with a readable message. **Not** a 500 from the database CHECK. |
| TC-TEN-N24 | remaining_amount can't be forced | `POST` with `"remaining_amount":"1.00"` | Ignored; the computed value is stored. |
| TC-TEN-N25 | Employee reads the summary | Swagger with `EMP-1`'s token → `GET /api/tenders/summary` | `403 FORBIDDEN`. Also confirm the KPI cards are absent from `/tenders` for `EMP-1` — and that **no** 403 appears in the console, i.e. the query never fires. |
| TC-TEN-N15 | Price beyond the column | `POST` with price `12345678901234.00` (over 12 digits) | `422` — `numeric(12,2)` is the limit. Should not be a 500. |
| TC-TEN-N16 | Total overflow | Quantity `999999999` with price `9999999999.99` | The product exceeds `numeric(14,2)`. Expected: a clean validation error. **⚠ Watch for a `500 INTERNAL_ERROR`** — a raw Postgres overflow reaching the user is a bug. |
| TC-TEN-N17 | Deleted client's tenders | Delete a client that has tenders | Their tenders vanish; the strip and dashboard drop consistently. No orphan rows. |

---

## 7. DSC Keys — `DSC`

Everyone can see **and edit** every key — that is the module's purpose ("find any client's key at a glance", `PRD.md` §4.5). Only deletion is admin-gated.

Three things are new: **`Key Lost` is retired**, issuing a key **requires** the holder's name and number, and every key carries a **history** you open by selecting its row.

### Positive

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-DSC-P01 | Log a key | **+ Log Key** → client, leave the status default, notes `Drawer 3 / Box B` | Row appears with status **Key Created** and the notes prominent. |
| TC-DSC-P02 | Notes are optional | Log a key with the notes blank | Saves. Notes column shows **—**, not "null". |
| TC-DSC-P03 | Find a key by location | Search `Drawer 3` | Matching rows returned — searching storage notes is the point of this module (`API_CONTRACT.md` §8). |
| TC-DSC-P04 | Search by company | Search a client's company name | Matches too. |
| TC-DSC-P05 | Status filter | Filter by each of `Key Created`, `Key Issued`, `Key Returned` | Each returns only its own rows. `Key Lost` is **not offered** at all. |
| TC-DSC-P06 | Client filter | Pick a client | Only their keys. |
| TC-DSC-P07 | Lifecycle | Edit one key through Created → Issued → Returned | Each save sticks; the pill colour changes with the status. Issuing demands a name and phone; returning does not. |
| TC-DSC-P07b | Issued rows are shaded | With one key set to **Key Issued**, look at the table | That row is tinted **red across its full width**, not just in its pill. Check the mobile card layout too (`DESIGN_SYSTEM.md` §3). |
| TC-DSC-P08 | In-office metric | Note the dashboard's **DSC Keys in Office**, then flip a key to **Key Issued** | The metric **decreases by 1** — only `Key Created` and `Key Returned` count as present (`API_CONTRACT.md` §9). |
| TC-DSC-P09 | Retired status is gone | Open the Key Status dropdown in the form | **Key Lost** is absent. If a pre-existing row still shows it, the row must still render without crashing — the pill falls back to a neutral tone. |
| TC-DSC-P10 | Everyone sees everything | As `EMP-2`, open `/dsc` | `EMP-1`'s keys are all visible. |
| TC-DSC-P11 | Delete | As `ADMIN-1`, delete an entry, confirm | Row gone; the in-office count adjusts if it was a present-state key. Employees have no Delete button. |
| TC-DSC-P12 | Issuance capture | Edit a key to **Key Issued** | An **Issued To** panel appears with Name and Phone Number, both required. Enter `Rohan Mehta` / `9876543210`, save. |
| TC-DSC-P13 | History opens on row click | Select the row you just issued | A drawer opens showing, newest first: **Issued out** (with Rohan Mehta and the number, your name, today) then **Key logged**. |
| TC-DSC-P14 | Actions don't open the history | Click **Edit** on a row | The edit drawer opens; the history drawer does **not** (`DESIGN_SYSTEM.md` §3). |
| TC-DSC-P15 | Return builds the trail | Set that key to **Key Returned** and save, then reopen the history | Three entries: Returned, Issued, Key logged. |
| TC-DSC-P16 | Re-issue to someone else | On a key already **Key Issued**, save it as Key Issued again with a *different* name and number | A second **Issued out** entry is recorded even though the status did not change. |
| TC-DSC-P17 | Editing notes records nothing | Change only the storage notes, then reopen the history | No new entry. |
| TC-DSC-P18 | Backfilled keys | Open the history of a key that existed before this change | A single **Key logged** entry, noted as backfilled. Never an empty drawer with no explanation. |

### Negative

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-DSC-N01 | No client selected | Submit with the dropdown on the placeholder | "Select a client". |
| TC-DSC-N02 | Notes over 500 chars | Paste 501 characters | Rejected; `422` from the API. |
| TC-DSC-N03 | Bad client reference | Swagger `POST /api/dsc` with a random `client_id` | `404 CLIENT_NOT_FOUND`. |
| TC-DSC-N04 | Unknown status | `POST` with `"key_status":"Key Broken"` | `422 VALIDATION_ERROR`. |
| TC-DSC-N04b | Retired status rejected | `POST` or `PATCH` with `"key_status":"Key Lost"` | `422 VALIDATION_ERROR`. The UI cannot send it; the API must refuse it anyway. |
| TC-DSC-N04c | Retired status filter | `GET /api/dsc?status=Key%20Lost` | `422`, not an empty 200. |
| TC-DSC-N05 | Unknown status filter | `GET /api/dsc?status=Key%20Broken` | `422`, not an empty 200. |
| TC-DSC-N06 | Employee edits another's key | `EMP-1` → `PATCH` a key `EMP-2` created | `200`. Open editing is intentional; **Added/Updated By** becomes `EMP-1`. |
| TC-DSC-N06b | Employee deletes a key | `EMP-1` → `DELETE` any key | `403 FORBIDDEN`. |
| TC-DSC-N07 | Issue with no name | `PATCH` `{"key_status":"Key Issued", "issued_phone":"9876543210"}` | `422` — "Enter who this key is being issued to." |
| TC-DSC-N08 | Issue with no phone | `PATCH` `{"key_status":"Key Issued", "issued_to":"Rohan"}` | `422`. |
| TC-DSC-N09 | Issue with a bad phone | Enter `12345` in the form's phone field | Rejected with the Indian-mobile message before any request fires. |
| TC-DSC-N10 | History of an unknown key | `GET /api/dsc/00000000-0000-0000-0000-000000000000/history` | `404 NOT_FOUND` — **not** an empty list. |
| TC-DSC-N11 | Deleting a key removes its history | As `ADMIN-1`, delete a key, then request its history | `404`. No orphaned events. |
| TC-DSC-N07 | Employee deletes another's key | Same for `DELETE` | `403 FORBIDDEN`. |
| TC-DSC-N08 | Non-existent key | `GET /api/dsc/{random uuid}` | `404 NOT_FOUND`. |
| TC-DSC-N09 | Deleted client's keys | Delete a client that has DSC keys | The keys disappear with it. |

---

## 8. Dashboard — `DASH`

The dashboard must never disagree with the module pages — every metric has a definition in `API_CONTRACT.md` §9. These are cross-checks, so run them **after** the module sections, when there's real data.

### Positive

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-DASH-P01 | Clients metric | Compare **Total Active Clients** against the record count in `/clients`' pager footer | Identical. |
| TC-DASH-P02 | Pending tenders metric | Compare **Pending Tenders** against `/tenders` filtered to **Pending** | Identical count. |
| TC-DASH-P03 | Paid value metric | As `ADMIN-1`, compare **Total Tender Value (Paid)** against **Total Paid Value** in the tenders strip with no filters | Identical rupee figure. |
| TC-DASH-P04 | DSC metric | Count `/dsc` rows whose status is `Key Created` or `Key Returned` | Equals **DSC Keys in Office**. |
| TC-DASH-P05 | Recent Tenders panel | Compare against the first rows of `/tenders` unfiltered | Same 5 rows, newest first, same order. |
| TC-DASH-P06 | Recent Clients panel | Same against `/clients` | Same 5, newest first. |
| TC-DASH-P07 | Live update | Create a client, then return to `/dashboard` | The count has gone up without a hard reload. |
| TC-DASH-P08 | Roles differ by one card | Open the dashboard as `ADMIN-1`, then as `EMP-1` | The admin sees **four** cards; the employee sees **three** — Total Tender Value (Paid) is absent. Everything else is identical. |
| TC-DASH-P08b | The value is withheld, not hidden | Swagger with `EMP-1`'s token → `GET /api/dashboard/summary` | `total_paid_tender_value` is **`null`**. The key is present; only the figure is withheld. |
| TC-DASH-P08c | Partially paid counts as neither | Log a Partially Paid tender, then reload the dashboard | **Pending Tenders** does not move, and **Total Tender Value (Paid)** does not move. It is its own status. |
| TC-DASH-P09 | Fewer than 5 records | On a near-empty database | Panels list only what exists; no blank placeholder rows, no error. |
| TC-DASH-P10 | Completely empty | With no data at all | Every card reads 0 / ₹0; panels show an empty state, not a crash or `NaN`. |

### Negative

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-DASH-N01 | Unauthenticated | `GET /api/dashboard/summary` with no token | `401 UNAUTHENTICATED`. |
| TC-DASH-N02 | No metric drift after a delete | Note all four cards, delete a client that has a paid tender and an in-office key, return to the dashboard | **Every** affected card moves, and each still matches its module page. A card that goes stale here is a cache-invalidation bug. |
| TC-DASH-N03 | Missing creator renders safely | Inspect a row whose `created_by` is null (the API contract allows it) | Renders **—**, not a crash (`API_CONTRACT.md` §8). |

---

## 9. Cross-Cutting — `XC`

### 9.1 Permission matrix walkthrough

Run this grid last, as a single sweep. It is `PRD.md` §3.3 turned into a checklist. For each cell, attempt the action **in the UI** and then **again through Swagger** with the same account — a hidden button proves nothing on its own.

**This grid changed.** There is no longer an ownership axis: editing is open to
everyone and deletion is admin-only (`PRD.md` §3.3). If any cell below still
behaves the old way, that is the bug.

| Action | `ADMIN-1` | `EMP-1` on own row | `EMP-1` on `EMP-2`'s row |
|---|:---:|:---:|:---:|
| View clients / credentials / tenders / DSC | ✅ | ✅ | ✅ (view is global) |
| Create in any module | ✅ | ✅ | n/a |
| Edit | ✅ | ✅ | ✅ **(now allowed)** |
| Delete | ✅ | 🚫 `403` | 🚫 `403` |
| Reveal a stored password | ✅ | ✅ | ✅ (deliberate) |
| See the tender KPI strip / `GET /api/tenders/summary` | ✅ | 🚫 `403` | 🚫 `403` |
| See `total_paid_tender_value` on the dashboard | ✅ | 🚫 `null` | 🚫 `null` |
| Manage portals / tender departments | ✅ | 🚫 `403` | 🚫 `403` |
| Onboard **or delete** users | ✅ | 🚫 `403` | 🚫 `403` |

After each successful cross-account edit, check the **Added/Updated By** column:
it must now name the editor, not the original author.

### 9.2 Other cases

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-XC-P01 | Timezone rendering | Create a record when UTC is between 18:30 and 00:00 (already the next day in IST) | The Date column shows the **IST** date, one day ahead of UTC (`PRD.md` §5). |
| TC-XC-P01b | Date filter agrees with the Date column | In that same window, filter `/tenders` to today's **IST** date | The tender you just logged is included. If it falls out, the filter is comparing UTC days (`API_CONTRACT.md` §7). |

### 9.3 Searchable dropdowns — `XC-DD`

Every client, portal and tender-department dropdown is now a searchable combobox
(`DESIGN_SYSTEM.md` §3). Run these on the Tender, Credential and DSC forms, and
on the client filters on `/tenders` and `/dsc`.

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-XC-DD01 | Type to filter | Click a client dropdown and type three letters of a company | The list narrows to matches as you type. |
| TC-XC-DD02 | Keyboard | With the list open, press ↓ ↓ then Enter | The highlighted option is selected and the list closes. |
| TC-XC-DD03 | Escape closes | Open the list, press Escape | It closes without changing the selection. |
| TC-XC-DD04 | Click outside closes | Open the list, click elsewhere on the page | It closes; the selection is unchanged. |
| TC-XC-DD05 | Clearable filters | On the `/tenders` client filter, pick a client, then click the **×** | Back to all clients; the table and pager reset. |
| TC-XC-DD06 | Past the first page | With **more than 50 clients**, search for one whose name sorts late | It is found. This is the case the old fixed-size dropdown silently failed — if it is missing, the search is not reaching the server. |
| TC-XC-DD07 | Editing keeps the selection | Edit an existing tender whose client sorts late in the list | Both client fields show the linked client immediately, before you type anything, and saving without touching them preserves it. |

### 9.4 Paired client fields — `XC-CP`

The Tender, Credential and DSC forms all pick a client by **either** contact name
or company name (`PRD.md` §4.4). Run each case on all three forms.

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-XC-CP01 | Name fills company | Type a contact person's name in **Client Name** and select | **Company Name** fills in automatically with their company. |
| TC-XC-CP02 | Company fills name | Do the reverse in **Company Name** | **Client Name** fills in automatically. |
| TC-XC-CP03 | Each field hints the other | Open either list | Each option shows its own value on the first line and the paired value beneath, so two clients at the same company are distinguishable. |
| TC-XC-CP04 | One value is submitted | Select via one field, save, and inspect the request in DevTools | The payload carries a single `client_id`. Neither name is sent. |
| TC-XC-CP05 | Validation fires once | Submit with neither field filled | One "Select a client" message, not two. |
| TC-XC-P02 | Empty states | Visit each list page with no matching data (search for `zzzzzz`) | A proper empty state with an icon and message on every page — not a bare table header. |
| TC-XC-P03 | Loading states | Throttle to Slow 3G in DevTools and navigate | A loading indication appears; no flash of "no records" before data lands. |
| TC-XC-P04 | Browser back/forward | Navigate through several pages, then Back and Forward repeatedly | Each page renders correctly; no blank screens. |
| TC-XC-P05 | Two tabs | Open `/clients` in two tabs, add a client in tab A, reload tab B | Tab B shows the new client. |
| TC-XC-P06 | Mobile layout | Resize to 375px on every page | Tables become stacked cards; nothing overflows horizontally; every action is reachable. |
| TC-XC-P07 | Tablet layout | 768px | Usable, per `PRD.md` §6. |
| TC-XC-N01 | Backend down | Stop the backend, then click around the app | A readable error per page — not a white screen or an infinite spinner. |
| TC-XC-N02 | Offline | DevTools → Network → Offline, then submit a form | A readable error; the form doesn't silently pretend to save. |
| TC-XC-N03 | CORS | With `CORS_ORIGINS=http://localhost:5173`, serve the frontend from a different port and try to log in | The request is blocked by the browser. Confirms the allowlist is enforced. |
| TC-XC-N04 | Page past the end | On a 1-page list, force `page=5` via the API | Empty `items`, correct `total_count`, `200` — not an error. In the UI, confirm **Next** is disabled on the last page. |
| TC-XC-N05 | Delete the last row on page 2 | With 26 records, go to page 2 (1 row) and delete it | **⚠ Known gap:** the page number probably doesn't auto-correct, leaving an empty table on page 2. Log it. |
| TC-XC-N06 | More than 100 clients | Create 101+ clients, then open the Tender / Credential / DSC form | **⚠ Known gap:** the client dropdown loads with `page_size=100`, so client #101 cannot be selected — records can't be logged against them at all. A real functional limit; confirm and log. |
| TC-XC-N07 | Search request volume | With the Network tab open, type a 10-character search term | **⚠ Known gap:** expect one request per keystroke (no debounce). Note the count — 10 requests for one search is worth filing. |
| TC-XC-N08 | Concurrent edit | Open the same client in two sessions, save a different change in each | Last write wins (no optimistic locking). Confirm neither session errors out and the surviving value is coherent — record the behaviour so it's at least known. |
| TC-XC-N09 | Response envelope consistency | Sample one success and one error response from each module in the Network tab | Success is always `{success:true, data:...}`; errors always `{success:false, error:{code, message}}` (root `CLAUDE.md` invariant 4). Any endpoint returning a bare payload or FastAPI's default `{"detail": ...}` is a bug. |
| TC-XC-N10 | No stack traces | Force a 500 (e.g. TC-TEN-N16) and read the response body | `{"success":false,"error":{"code":"INTERNAL_ERROR","message":"An unexpected error occurred."}}` — no traceback, no SQL, no table names reach the client. |

---

## 10. Prototype Sign-Off Run

`PRD.md` §7 defines "done". This is that list as one continuous scenario — run it start to finish on a **fresh database** as the final acceptance pass.

| Step | Action | Pass when |
|---|---|---|
| 1 | Bootstrap the first admin via `app/scripts/create_admin.py` | The script completes and that admin can sign in. |
| 2 | As Admin: create a portal, create a tender department, onboard an employee | All three appear in their tables. |
| 3 | Sign out. Sign in as that employee | Dashboard loads; no Administration nav. |
| 4 | As Employee: onboard a client | Appears in `/clients`. |
| 5 | Save a portal credential for that client | Appears masked in `/credentials`; Reveal returns the right password. |
| 6 | Log a tender for that client | Total is computed correctly; the strip updates. |
| 7 | Log a DSC key for that client | Appears in `/dsc`; the dashboard's in-office count includes it. |
| 8 | Verify the §9.1 permission matrix end to end | Every 🚫 cell returns `403`, in the UI **and** via the API. |
| 9 | Verify pagination and every search/filter input | All work, on every list page. |
| 10 | Repeat steps 3–7 against the deployed Vercel URLs | Both projects live, talking over HTTPS. |

---

## 11. Defect Log Template

```
ID:          BUG-001
Test case:   TC-CLI-N15
Severity:    High | Medium | Low
Environment: local | vercel  ·  browser + version
Steps:       1. …
             2. …
Expected:    (quote the spec line — PRD §x.y or API_CONTRACT §z)
Actual:      what happened, with the exact error text / status code
Evidence:    screenshot, Network tab request + response
```

Severity guide for this app: anything that lets one employee modify another's records, exposes a password without auth, or lets `total_amount` be set by the client is **High** regardless of how hard it is to trigger.
