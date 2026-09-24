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
| TC-AUTH-P04 | Session survives reload | Sign in, navigate to `/tenders`, press F5 | Brief "Loading…", then `/tenders` renders with data. You are **not** bounced to the login page, and **not** shown a host 404 (`ARCHITECTURE.md` §2). |
| TC-AUTH-P04b | Reload every page **on the deployed site** | Sign in, then visit and reload each of `/dashboard`, `/clients`, `/credentials`, `/tenders`, `/emd`, `/dsc`, `/expenses`, `/admin/users`, `/admin/portals`, `/admin/tender-departments` | Every one reloads into the app. A **404 from Vercel** on any of them means the SPA rewrite is missing from `frontend/vercel.json` — the failure this case exists to catch. |
| TC-AUTH-P04c | Pasted deep link | Copy `/tenders` from one browser and paste it into a fresh tab where you are signed in | Opens the Tenders page directly. |
| TC-AUTH-P04d | Deep link while signed out | Sign out, paste `/emd` into the address bar, then sign in | You land on **`/emd`**, not the dashboard — the destination survives the sign-in. |
| TC-AUTH-P04e | Unknown path | Signed in, visit `/nonsense` | The app's own **Page not found** screen with a Back to dashboard button, inside the normal shell — not the router's raw error text and not a host 404. |
| TC-AUTH-P05 | Silent token refresh | Set `JWT_ACCESS_TTL_MINUTES=1`, restart backend, sign in, wait ~90s, then click **Clients** | Page loads normally. Network tab shows a `401 TOKEN_EXPIRED`, then `POST /api/auth/refresh`, then the original request retried and succeeding. You are never sent back to login. |
| TC-AUTH-P06 | Logout | Click Sign out, then **Confirm** in the dialog | A confirmation appears first. On confirming: back to `/`, and `localStorage.refresh_token` is gone (DevTools → Application). |
| TC-AUTH-P06b | Cancelling the sign-out | Click Sign out, then **Cancel** | You stay exactly where you were, still signed in. No request fires. |
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
| TC-USER-P08 | Onboard without an email | Onboard a user leaving Email blank | Created. The Email column shows **—**, not "null" (`PRD.md` §4.1). |
| TC-USER-P08b | Two accounts with no email | Onboard a second user with Email blank | Also created — a blank email is stored as *no* email, so the two don't collide (`DATABASE_SCHEMA.md` §1.1). |
| TC-USER-P08c | Sign in without an email | Sign in as the user from P08 | Succeeds. A user with no email must still be able to log in. |
| TC-USER-P09 | Edit every field | Edit a user: change name, username, email and role, and set a new password → Save | All four update in the table. Sign in with the **new** username and **new** password — both work, and the old username no longer does (`API_CONTRACT.md` §2). |
| TC-USER-P09b | Edit without touching the password | Edit a user, change only the name, leave New Password blank | Saves. Their existing password still works. |
| TC-USER-P09c | Clear an email | Edit a user with an email, empty the Email box, save | Column shows **—**. |
| TC-USER-P09d | Renaming yourself doesn't sign you out | As `ADMIN-1`, edit your own row and change your username | Stays signed in — the session's token carries your id, not your username. The next sign-in needs the new one. |

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
| TC-USER-N07 | Invalid email | `notanemail` | "Invalid email". A **blank** email is fine — it means the account has none. |
| TC-USER-N08 | Employee creates a user | Swagger with `EMP-1`'s token → `POST /api/admin/users` | `403 FORBIDDEN`. |
| TC-USER-N09 | Cancel discards input | Open the drawer, type a name, Cancel, reopen | Fields empty — the form resets. |
| TC-USER-N10 | More than 25 users | Create 26+ users, load `/admin/users` | **⚠ Known gap:** the page requests page 1 with no pager, so users 26+ are unreachable in the UI. Confirm and log. |
| TC-USER-N11 | Self-delete via API | Swagger with `ADMIN-1`'s token → `DELETE /api/admin/users/{ADMIN-1's own id}` | `422 CANNOT_DELETE_SELF`. |
| TC-USER-N12 | Deleting the last admin | Deactivate `ADMIN-2` so `ADMIN-1` is the only active admin, then have `ADMIN-2`'s session (or a second admin) try to delete `ADMIN-1` | `422 LAST_ADMIN`. Also try deactivating and demoting the last admin — both refused. **Restore `ADMIN-2` afterwards.** |
| TC-USER-N13 | Employee deletes a user | Swagger with `EMP-1`'s token → `DELETE /api/admin/users/{any id}` | `403 FORBIDDEN`. |
| TC-USER-N14 | Duplicate username on edit | Edit a user and set their username to one another account already holds | `409 USERNAME_EXISTS`. The row is unchanged. |
| TC-USER-N15 | Duplicate email on edit | Same, with an email another account holds | `409 EMAIL_EXISTS`. |
| TC-USER-N16 | Invalid username on edit | Edit a user, set the username to `a b!` | Rejected with the 3-30 character rule; no request fires. |
| TC-USER-N17 | Blank password on edit isn't a weak password | Edit a user, leave New Password empty, save | Saves. **No** "at least 8 characters" error — blank means "don't change it" (`PRD.md` §4.1). |

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
| TC-CLI-P11 | Bank details on creation | Onboard a client, filling **Bank Details** with three lines (bank, A/C, IFSC) | Saves. The table's Bank Details column shows it clamped to one line; hovering shows the whole value. |
| TC-CLI-P12 | Bank details are optional | Onboard a client leaving Bank Details empty | Saves. The column shows **—**, not "null". |
| TC-CLI-P13 | An employee can add them later | As `EMP-2`, edit a client `EMP-1` onboarded and fill in Bank Details | Allowed — this is not an admin field (`PRD.md` §4.2). Onboarded/Updated By becomes `EMP-2`. |
| TC-CLI-P14 | Clearing bank details | Edit a client with details saved, empty the box, save | Column returns to **—**. |
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
| TC-CLI-N13 | Cancel the delete confirm | Click Delete, then Cancel in the confirmation dialog | Row remains. No request fires. |
| TC-CLI-N14 | Audit fields can't be spoofed | Swagger `POST /api/clients` with `"created_by": "<another user id>"` and `"created_at": "2020-01-01T00:00:00Z"` in the body | Both ignored. Response shows **you** as creator and now as the timestamp (root `CLAUDE.md` invariant 2). |
| TC-CLI-N15 | Email case collision | Create `rohan@mehta.com`, then try `ROHAN@MEHTA.COM` | **⚠ Known gap:** the uniqueness check is an exact match, so the second is likely **accepted**. Two clients with the same email in different case is almost certainly wrong — log it. |
| TC-CLI-N20 | Bank details over the cap | Paste 501 characters into Bank Details | Rejected with "At most 500 characters"; `422` if sent via Swagger. |
| TC-CLI-N21 | Whitespace-only bank details | Enter only spaces and save | Stored as **no** details (column shows —), not as a blank string. |
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
| TC-MSTR-P10 | Delete an unused entry | Add a throwaway portal, don't use it anywhere, then Delete → confirm | Row disappears, and it is gone from the dropdowns too. Repeat on `/admin/tender-departments`. |
| TC-MSTR-P11 | Employee can't delete | Swagger with `EMP-1`'s token → `DELETE /api/portals/{id}` | `403 FORBIDDEN`. |

### Negative

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-MSTR-N01 | Duplicate portal name | Add `GeM Portal` twice | `409 PORTAL_EXISTS` → "A portal with this name already exists." |
| TC-MSTR-N02 | Duplicate tender department | Add `PMC` again | `409 TENDER_DEPARTMENT_EXISTS`. |
| TC-MSTR-N03 | Blank name | Submit empty | "Required". No request. |
| TC-MSTR-N04 | Name over 120 chars | Paste 121 chars | Rejected; `422` from the API. |
| TC-MSTR-N05 | Employee writes a master list | Swagger with `EMP-1`'s token → `POST /api/portals`, then `PATCH /api/portals/{id}` | `403 FORBIDDEN` on both. |
| TC-MSTR-N06 | Deleting an entry in use is refused | Add a portal, save a credential against it, then delete the portal and confirm | The dialog **stays open** and shows "used by 1 saved credential(s) … Deactivate it instead". The portal is still listed. Repeat on a tender department that has a tender: same, naming tenders (`API_CONTRACT.md` §4, §6). |
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
| TC-TEN-P21 | Date range filter | Set **From** and **To** to today | Today's tenders only. Set **To** to yesterday: none. Both ends are inclusive. |
| TC-TEN-P25 | Date defaults to today | Open **Log Tender** | **Tender Date** is the first field and is pre-filled with today's date (IST). Saving without touching it logs it for today. |
| TC-TEN-P26 | Backdate a tender | Log a tender with Tender Date set to 10 days ago | The row's **Date** column shows that date, not today. |
| TC-TEN-P26b | The filter follows the tender's date | Filter From/To to that backdated day, then to today | The backdated tender appears on **its own** date and is **absent** from today — the filter follows `tender_date`, not when it was typed (`API_CONTRACT.md` §7). |
| TC-TEN-P26c | Ordering follows the tender's date | With both tenders from P25/P26 present, look at the table | Today's row sits **above** the backdated one, even though the backdated one was created later. |
| TC-TEN-P27 | Correct a date | Edit any tender and change Tender Date | Saves; the Date column and the row's position both move. |
| TC-TEN-P28 | Row shading by payment state | Look at a table holding all three statuses | Pending rows are tinted **red**, Partially Paid **blue**, Paid **green**, across the full row width. The tint is clearly visible without being strong enough to fight the text (`-100/70`, `DESIGN_SYSTEM.md` §3). Hover a row: the tint stays (it darkens, it does not vanish). Narrow to 390px — the cards carry the same shading. |
| TC-TEN-P29 | Select one | As `ADMIN-1`, tick one row's checkbox | A bar appears above the table: "1 selected", **Clear selection**, **Delete selected**. |
| TC-TEN-P30 | Select all on the page | Tick the header checkbox | Every row on the page is ticked and the count matches. Untick it — all clear. |
| TC-TEN-P31 | Indeterminate state | Tick two rows out of many | The header checkbox shows a dash, not a tick. |
| TC-TEN-P32 | The client workflow | Filter to a client with several tenders, tick the header checkbox, **Delete selected**, confirm | All of that client's listed tenders disappear in one go. The KPI strip and the dashboard drop accordingly. |
| TC-TEN-P33 | Beyond one page | With a filter matching **more than 25** rows, tick the header checkbox | "Select all N matching this filter" appears. Click it: the count becomes N, not 25. Deleting then clears them all. |
| TC-TEN-P34 | Selection clears on filter change | Select some rows, then change the status filter | The bar disappears — the selection is dropped, so nothing can be deleted from a view you have left. |
| TC-TEN-P35 | Selection clears on page change | Select rows, then go to page 2 | Same: selection cleared. |
| TC-TEN-P36 | The confirmation states the cost | Select 3 paid tenders and press Delete | The dialog names the count **and** says the paid ones leave the revenue totals, including past date ranges. Cancel leaves everything untouched. |
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
| TC-TEN-N26 | Employee sees no checkboxes | As `EMP-1`, open `/tenders` | **No** checkbox column and no selection bar — deletion is admin-only, so a selection would lead nowhere. |
| TC-TEN-N27 | Employee bulk-deletes via the API | Swagger with `EMP-1`'s token → `POST /api/tenders/bulk-delete` with any ids | `403 FORBIDDEN`. The rows are still there. |
| TC-TEN-N28 | Empty bulk delete | `POST /api/tenders/bulk-delete` with `{"ids": []}` | `422 VALIDATION_ERROR`. |
| TC-TEN-N29 | Over the cap | `POST` with 101 ids | `422 VALIDATION_ERROR` — the API takes at most 100 per call, and the UI chunks larger selections automatically. |
| TC-TEN-N30 | Already-deleted id | Delete a tender, then bulk-delete that same id | `200` with `deleted: 0, requested: 1` — not a `404`. |
| TC-TEN-N31 | Bulk delete is not a filter | `POST` with two ids while a client filter is applied in the UI | Exactly those two rows go. Nothing else matching the filter is touched (`API_CONTRACT.md` §7). |
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
| Manage portals / tender departments (including deleting an unused one) | ✅ | 🚫 `403` | 🚫 `403` |
| Onboard, **edit** or delete users | ✅ | 🚫 `403` | 🚫 `403` |
| Open `/expenses`, or call any `/api/expenses` route | ✅ | 🚫 `403` | 🚫 `403` |
| View and log EMDs | ✅ | ✅ | ✅ (open edit) |
| Delete an EMD | ✅ | 🚫 `403` | 🚫 `403` |

After each successful cross-account edit, check the **Added/Updated By** column:
it must now name the editor, not the original author.

### 9.2 Other cases

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-XC-P01 | Timezone rendering | Create a record when UTC is between 18:30 and 00:00 (already the next day in IST) | The Date column shows the **IST** date, one day ahead of UTC (`PRD.md` §5). |
| TC-XC-P01b | Date filter agrees with the Date column | In that same window, filter `/tenders` to today's **IST** date | The tender you just logged is included. Its Tender Date defaulted to the **IST** day, so a UTC default would show up here as an off-by-one (`API_CONTRACT.md` §7). |

### 9.5 Confirmation dialogs — `XC-CD`

Every destructive action confirms in an in-app modal (`DESIGN_SYSTEM.md` §3).
Run these on one delete, then spot-check the rest: clients, credentials,
tenders, DSC keys, users, portals and tender departments.

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-XC-CD01 | No browser dialogs anywhere | Trigger every delete in the app | Each one opens a styled in-app modal — square corners, app typeface, centred over a dim scrim. **Never** the browser's own grey confirm box, and never an `alert()` for an error. |
| TC-XC-CD02 | Cancel does nothing | Open a delete dialog, click Cancel | Closes, row untouched, no request in the network tab. |
| TC-XC-CD03 | Escape and scrim dismiss | Reopen, press Escape. Reopen, click the dim area outside | Both close it harmlessly. |
| TC-XC-CD04 | Enter doesn't delete | Open a delete dialog and immediately press Enter | **Nothing is deleted** — focus sits on Cancel, so Enter cancels. |
| TC-XC-CD05 | Errors show inside the dialog | Delete a portal that has credentials (TC-MSTR-N06) | The dialog stays open with the server's message in a red block inside it. No browser alert, and the page behind is unchanged. |
| TC-XC-CD06 | The dialog says what is lost | Read each delete dialog | It names the record and its consequences — a client says its credentials, tenders and keys go too; a user says their attribution is stripped and points at Deactivate. |
| TC-XC-CD07 | Background is locked | With a dialog open, try to scroll the page behind it | It doesn't scroll. |

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

---

## 12. Expenses — `EXP`

Admin-only in full (`PRD.md` §4.7). Unlike every other module this includes
reading, so the first two negative cases matter more than usual: an employee
must not reach the page *or* the API.

Run the positive cases as `ADMIN-1`.

### Positive

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-EXP-P01 | The tab exists for admins | Sign in as `ADMIN-1` | **Expenses** appears in the sidebar's Administration group. |
| TC-EXP-P02 | Log an expense | **Log Expense** → amount `2500`, details "Diesel for the office generator", status Pending → save | Row appears with Date = today (IST), ₹2,500, a **Pending** pill, and your name under Added/Updated By. |
| TC-EXP-P03 | Date defaults to today | Open the drawer | **Date** is pre-filled with today's date and is the first field. |
| TC-EXP-P04 | Backdate an expense | Log one with Date set to 10 days ago | The row's Date shows that day, not today. |
| TC-EXP-P05 | Long details are kept whole | Paste ~2,000 characters into Details and save | Accepted in full — there is no length limit (`API_CONTRACT.md` §11). Reopen the row and confirm nothing was truncated. |
| TC-EXP-P06 | KPI strip | With a mix of Paid and Pending rows, read the three cards | **Total Expenses**, **Paid Amount**, **Pending Amount**. Paid + Pending equals Total — check it by hand. |
| TC-EXP-P07 | Strip follows the filter | Set the status filter to **Paid** | Only paid rows listed; the Pending card disappears and Total describes just the filtered rows. |
| TC-EXP-P08 | Date range filter | Set From/To to today, then To = yesterday | Today's expenses, then none. Both ends are inclusive. |
| TC-EXP-P09 | Filter drives the strip too | With a date range applied, compare the cards against the visible rows | They agree. |
| TC-EXP-P10 | Search the details | Search a word from one expense's note | Only matching rows; the pager count reflects matches. |
| TC-EXP-P11 | Mark one paid | Edit a Pending expense, set status **Paid**, save | Pill turns green, the row shading flips red → green, and the Paid/Pending cards move without a reload. |
| TC-EXP-P12 | Row shading | Look at a table holding both statuses | Pending rows tinted red, Paid tinted green, full width. Hovering keeps the tint. |
| TC-EXP-P13 | Delete | Delete an expense and confirm | Confirmation dialog names the amount and the details. Row disappears and the cards drop accordingly. |
| TC-EXP-P14 | Clear filters | Set several filters, click **Clear filters** | Everything resets to page 1. |
| TC-EXP-P15 | Mobile | Narrow to 390px | Each row becomes a card headed by the details text, with the actions opposite. Nothing scrolls horizontally. |

### Negative

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-EXP-N01 | Employee cannot see the tab | Sign in as `EMP-1` | **No** Expenses entry in the sidebar — the whole Administration group is absent. |
| TC-EXP-N02 | Employee cannot reach the route | As `EMP-1`, type `/expenses` in the address bar | Redirected to `/dashboard`. No flash of the table or the figures. |
| TC-EXP-N03 | Employee cannot read the API | Swagger with `EMP-1`'s token → `GET /api/expenses`, then `GET /api/expenses/summary` | `403 FORBIDDEN` on **both**. This is the case the module exists to protect — hiding the tab alone would not be enough (`PRD.md` §4.7). |
| TC-EXP-N04 | Employee cannot write | As `EMP-1`, `POST /api/expenses` | `403 FORBIDDEN`. |
| TC-EXP-N05 | Unauthenticated | `GET /api/expenses` with no token | `401 UNAUTHENTICATED`. |
| TC-EXP-N06 | Empty details | Submit with Details blank | "Required". No request fires. |
| TC-EXP-N07 | Whitespace-only details | Enter only spaces | Rejected — a note of nothing is not a record of anything. |
| TC-EXP-N08 | Negative amount | `-100` | Rejected before submit; `422` via Swagger. |
| TC-EXP-N09 | Too many decimals | `100.999` | "At most 2 decimal places". |
| TC-EXP-N10 | Non-numeric amount | `abc` | Rejected, no request fires. |
| TC-EXP-N11 | Unknown status via API | `POST /api/expenses` with `"status":"Partially Paid"` | `422 VALIDATION_ERROR` — the enum is `Paid` / `Pending` only. |
| TC-EXP-N12 | Audit fields can't be spoofed | `POST` with `"created_by"` and `"created_at"` in the body | Both ignored; the response names **you** and now (root `CLAUDE.md` invariant 2). |
| TC-EXP-N13 | Unknown id | `PATCH`/`DELETE` a random uuid | `404 NOT_FOUND`. |

---

## 13. EMD — `EMD`

Deposits held for a client (`PRD.md` §4.8). Open to everyone, like tenders;
only deletion is admin-only. Run the positives as `EMP-1` unless stated — that
is the point of the module being open.

### Positive

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-EMD-P01 | The tab is there for everyone | Sign in as `EMP-1` | **EMD** appears in the sidebar's Workspace group, under Tenders. |
| TC-EMD-P02 | Log a deposit | **Log EMD** → pick a client, amount `5000`, leave status as **With Us** → save | Row appears: today's date, the client's name and company, ₹5,000, a blue **With Us** pill, your name under Added/Updated By. |
| TC-EMD-P03 | Everything is typed | Open the drawer | **Client Name**, **Company Name** and **Contact Number** are plain text boxes — no dropdown, no search, nothing prefilled (`PRD.md` §4.8). |
| TC-EMD-P04 | A stranger can be logged | Log a deposit for a name that exists nowhere in `/clients` | Saves normally. This is the point of the change — no client record is required. |
| TC-EMD-P05 | Bank account is recorded | Fill **Paid To — Bank Account Details** with three lines | Saves. The **Paid To** column shows it clamped to one line, full value on hover. Leaving it empty shows **—**. |
| TC-EMD-P06 | Date defaults to today | Open the drawer | **Date** is pre-filled with today (IST). |
| TC-EMD-P07 | Backdate | Log one dated a week ago | The row's Date shows that day, and it sorts below today's. |
| TC-EMD-P08 | Return a deposit | Edit a **With Us** row, set status **Returned**, save | Pill turns green, the row shading goes blue → green, and the KPI cards move without a reload. |
| TC-EMD-P09 | KPI strip | With a mix of both statuses, read the cards | **Total With Us** and **Total Returned**. Check With Us by hand — it is the money you are holding. |
| TC-EMD-P10 | Strip follows the filter | Set the status filter to **Returned** | Only returned rows; the With Us card disappears and the totals describe the filtered set. |
| TC-EMD-P11 | Bulk delete | As `ADMIN-1`, tick two rows → **Delete selected** → confirm | Both disappear in one go and the cards drop. Same behaviour as the Tenders page: header checkbox covers the page, "Select all N matching" appears beyond it, and the selection clears when the filter or page changes. |
| TC-EMD-P12 | Search | Search a company name, then a contact person, then a deposit's phone number | All three match (`API_CONTRACT.md` §12). |
| TC-EMD-P13 | Date range | Set From/To to today, then To = yesterday | Today's deposits, then none. Both ends inclusive. |
| TC-EMD-P14 | An employee edits another's row | As `EMP-2`, edit a deposit `EMP-1` logged | Allowed. **Added/Updated By** becomes `EMP-2`. |
| TC-EMD-P15 | Admin deletes | As `ADMIN-1`, delete a deposit and confirm | The dialog names the amount and the company. Row gone, cards drop. |
| TC-EMD-P16 | Mobile | Narrow to 390px | Cards headed by the client's name, actions opposite, nothing scrolling sideways. |

### Negative

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-EMD-N01 | No client selected | Submit with both client fields empty | "Select a client". No request fires. |
| TC-EMD-N02 | Landline as the contact | `2212345678` | Rejected — Indian mobiles start 6-9, same rule as everywhere else. |
| TC-EMD-N03 | Blank contact number | Clear the number and save | "Required". |
| TC-EMD-N04 | Phone normalization | Save with `+91 98765-43210` | Accepted and stored as **9876543210**. |
| TC-EMD-N05 | Negative amount | `-100` | Rejected before submit; `422` via Swagger. |
| TC-EMD-N06 | Too many decimals | `100.999` | "At most 2 decimal places". |
| TC-EMD-N07 | Employee deletes | As `EMP-1`, look at any row, then try `DELETE /api/emds/{id}` via Swagger | No Delete button in the UI; `403 FORBIDDEN` from the API. |
| TC-EMD-N08 | Unauthenticated | `GET /api/emds` with no token | `401 UNAUTHENTICATED`. |
| TC-EMD-N09 | Unknown client | `POST /api/emds` with a random `client_id` | `404 CLIENT_NOT_FOUND`. |
| TC-EMD-N10 | Unknown status | `POST` with `"status":"Refunded"` | `422 VALIDATION_ERROR` — the enum is `With Us` / `Returned` exactly. |
| TC-EMD-N11 | Deleting a client leaves deposits | Log a deposit naming a client, then delete that client from `/clients` | The deposit **remains** — it holds typed text, not a link (`DATABASE_SCHEMA.md` §2). This is the documented trade-off of typing the names. |
| TC-EMD-N13 | Blank client or company | Submit with either box empty | "Required". No request fires. |
| TC-EMD-N14 | Employee sees no checkboxes | As `EMP-1`, open `/emd` | No checkbox column and no selection bar — deletion is admin-only. |
| TC-EMD-N12 | Audit fields can't be spoofed | `POST` with `created_by` / `created_at` in the body | Both ignored (root `CLAUDE.md` invariant 2). |

---

## 14. Payer details on tenders — `TEN-PAY`

Who came in with the money (`PRD.md` §4.4). Both fields are optional.

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-TEN-PAY01 | Both blank | Log a tender without touching either field | Saves. The **Paid By** column shows **—**. |
| TC-TEN-PAY02 | Name and number | Log one with a name and `+91 98765 43210` | Saves. Paid By shows the name with **9876543210** beneath it — the number is normalized like every other phone field. |
| TC-TEN-PAY03 | Name only | Fill the name, leave the number empty | Saves. Only the name shows. |
| TC-TEN-PAY04 | A different payer next time | Edit the tender and change the name and number | Both update. This is the point: the person who comes in is different each visit. |
| TC-TEN-PAY05 | Half-typed number | Enter `12345` | Rejected — optional, but a number that *is* given must be a real Indian mobile. |
| TC-TEN-PAY06 | Whitespace only | Type spaces into the name and save | Stored as nothing, not as a blank string: the column shows **—**. |

---

## 15. Settling a client's dues — `TEN-SET`

The lump-sum payment flow (`PRD.md` §4.4). Available to **everyone**, not just
admins. Set up: one client with three pending tenders of ₹3,000, ₹3,000 and
₹4,000, logged on three different days so the order is unambiguous.

### Positive

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-TEN-SET01 | The panel appears | On `/tenders`, pick that client in the Client filter | Under the rows: **Pending for this client ₹10,000**, "across 3 unpaid tender(s)", and a **Record Payment** button. |
| TC-TEN-SET02 | Only for one client | Clear the client filter | The panel disappears. A lump sum belongs to a person, not to a filter. |
| TC-TEN-SET03 | Preview first | Record Payment → amount `5000`, mode Cash → **Preview allocation** | Shows **₹3,000 to the oldest → Paid** and **₹2,000 to the next → Partially Paid**, and "₹5,000 will still be outstanding". Nothing has changed in the table yet — check a row behind the drawer. |
| TC-TEN-SET04 | Apply it | Press **Apply ₹5,000** | Drawer closes. Oldest tender is **Paid** (remaining ₹0), second is **Partially Paid** at ₹2,000 of ₹3,000 (remaining ₹1,000), third is untouched **Pending**. The panel now reads ₹5,000 across 2 tenders. |
| TC-TEN-SET05 | Row shading follows | Look at the three rows | Green, blue and red respectively — the shading tracks the new statuses. |
| TC-TEN-SET06 | Editing the amount re-previews | Reopen, type `1000`, preview, then change it to `2000` | The button returns to **Preview allocation**; a stale plan is never applied. |
| TC-TEN-SET07 | Payment mode is recorded | Settle with **Online** | Every tender the payment touched shows `Online` under its status pill. |
| TC-TEN-SET08 | Tops up a partial tender | With one tender at ₹1,000 of ₹3,000, pay ₹2,000 | That tender goes to **Paid** — the oldest debt is filled before the next is started. |
| TC-TEN-SET09 | Clearing everything | Pay exactly the outstanding figure | All tenders go Paid, the panel reads **₹0** and Record Payment is disabled. |
| TC-TEN-SET10 | An employee can do it | Repeat TC-TEN-SET04 signed in as `EMP-1` | Works. The panel and its figure are visible to employees — this is one client's balance, not the business's revenue (`PRD.md` §4.4). |

### Negative

| ID | Case | Steps | Expected |
|---|---|---|---|
| TC-TEN-SET-N01 | Overpayment | Owing ₹10,000, enter `12000` and preview | Refused: "This client owes 10000.00, which is less than the 12000.00 entered." Nothing changes — re-check the outstanding figure. |
| TC-TEN-SET-N02 | Nothing outstanding | Filter to a client whose tenders are all Paid | Record Payment is disabled. Via Swagger, `POST /api/tenders/settle` for them → `422 NOTHING_OUTSTANDING`. |
| TC-TEN-SET-N03 | Zero or negative | Enter `0`, then `-100` | Rejected before submit. |
| TC-TEN-SET-N04 | Missing payment mode | Swagger: `POST /api/tenders/settle` without `payment_mode` | `422 VALIDATION_ERROR` — money moved, so the mode is required exactly as on a tender. |
| TC-TEN-SET-N05 | Someone else's debt | Client A owes ₹10,000, client B owes ₹5,000. Settle ₹5,000 for A | B's outstanding is still ₹5,000. Money must never pay down another client's debt. |
| TC-TEN-SET-N06 | Preview writes nothing | Preview ₹5,000, then close the drawer without applying | The table and the panel are unchanged. |
| TC-TEN-SET-N07 | Unknown client | Swagger with a random `client_id` | `404 CLIENT_NOT_FOUND`. |
| TC-TEN-SET-N08 | Paid tenders are never touched | Settle an amount, then check any tender that was already Paid before | Its `paid_amount`, mode and status are exactly as they were. |
