"""Admin user management.

Onboarding takes a username and an optional email (CH-02, CH-25), admins can
edit every field of an account including its username and password (CH-24),
and users can be deleted outright rather than only deactivated (CH-01) — with
two guards, since either mistake locks people out of the tool in a way the UI
cannot undo.
"""


def _payload(uniq: str, **overrides) -> dict:
    return {
        "full_name": "New Employee",
        "username": f"new.employee-{uniq}",
        "email": f"new.employee-{uniq}@example.com",
        "password": "Password123",
        "role": "employee",
        **overrides,
    }


async def test_create_user_happy_path(client, admin_headers, uniq):
    resp = await client.post("/api/admin/users", json=_payload(uniq), headers=admin_headers)

    assert resp.status_code == 201
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["username"] == f"new.employee-{uniq}"
    assert body["data"]["email"] == f"new.employee-{uniq}@example.com"
    assert body["data"]["role"] == "employee"
    assert "password" not in body["data"]


async def test_create_user_lowercases_the_username(client, admin_headers, uniq):
    resp = await client.post(
        "/api/admin/users",
        json=_payload(uniq, username=f"New.Employee-{uniq}"),
        headers=admin_headers,
    )

    assert resp.status_code == 201
    assert resp.json()["data"]["username"] == f"new.employee-{uniq}"


async def test_create_user_requires_a_username(client, admin_headers, uniq):
    payload = _payload(uniq)
    del payload["username"]

    resp = await client.post("/api/admin/users", json=payload, headers=admin_headers)

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_user_without_an_email(client, admin_headers, uniq):
    """Email is an optional contact address, not a credential (CH-25)."""
    payload = _payload(uniq)
    del payload["email"]

    resp = await client.post("/api/admin/users", json=payload, headers=admin_headers)

    assert resp.status_code == 201
    assert resp.json()["data"]["email"] is None


async def test_blank_emails_do_not_collide(client, admin_headers, uniq):
    """A blank box is stored as no email, so the unique constraint never trips on it."""
    first = await client.post(
        "/api/admin/users", json=_payload(uniq, email=""), headers=admin_headers
    )
    second = await client.post(
        "/api/admin/users",
        json=_payload(uniq, username=f"second-{uniq}", email=""),
        headers=admin_headers,
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["data"]["email"] is None
    assert second.json()["data"]["email"] is None


async def test_user_without_an_email_can_sign_in(client, admin_headers, uniq):
    payload = _payload(uniq)
    del payload["email"]
    await client.post("/api/admin/users", json=payload, headers=admin_headers)

    resp = await client.post(
        "/api/auth/login", json={"username": payload["username"], "password": "Password123"}
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["user"]["email"] is None


async def test_create_user_rejects_an_invalid_email(client, admin_headers, uniq):
    resp = await client.post(
        "/api/admin/users", json=_payload(uniq, email="notanemail"), headers=admin_headers
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_user_rejects_an_invalid_username(client, admin_headers, uniq):
    resp = await client.post(
        "/api/admin/users", json=_payload(uniq, username="a b!"), headers=admin_headers
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_user_requires_auth(client, uniq):
    resp = await client.post("/api/admin/users", json=_payload(uniq))

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_create_user_requires_admin(client, employee_headers, uniq):
    resp = await client.post("/api/admin/users", json=_payload(uniq), headers=employee_headers)

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_create_user_duplicate_username(client, admin_headers, make_user, uniq):
    existing, _ = await make_user(username=f"dup-{uniq}", email=f"dup-{uniq}@example.com")

    resp = await client.post(
        "/api/admin/users",
        json=_payload(uniq, username=existing.username),
        headers=admin_headers,
    )

    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "USERNAME_EXISTS"


async def test_create_user_duplicate_email(client, admin_headers, make_user, uniq):
    existing, _ = await make_user(username=f"dup-{uniq}", email=f"dup-{uniq}@example.com")

    resp = await client.post(
        "/api/admin/users", json=_payload(uniq, email=existing.email), headers=admin_headers
    )

    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "EMAIL_EXISTS"


async def test_create_user_weak_password(client, admin_headers, uniq):
    resp = await client.post(
        "/api/admin/users", json=_payload(uniq, password="short"), headers=admin_headers
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_list_users_happy_path(client, admin_headers, admin_user):
    user, _password = admin_user

    resp = await client.get(
        "/api/admin/users", params={"search": user.email}, headers=admin_headers
    )

    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["page"] == 1
    assert body["page_size"] == 25
    assert any(item["email"] == user.email for item in body["items"])


async def test_list_users_searches_by_username(client, admin_headers, admin_user):
    user, _password = admin_user

    resp = await client.get(
        "/api/admin/users", params={"search": user.username}, headers=admin_headers
    )

    assert any(item["username"] == user.username for item in resp.json()["data"]["items"])


async def test_patch_user_toggles_active(client, admin_headers, make_user, uniq):
    target, _ = await make_user(email=f"target-{uniq}@example.com")

    resp = await client.patch(
        f"/api/admin/users/{target.id}",
        json={"is_active": False},
        headers=admin_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["is_active"] is False


# --------------------------------------------------------------------------
# Editing (CH-24)
# --------------------------------------------------------------------------


async def test_patch_user_edits_every_field(client, admin_headers, make_user, uniq):
    target, _ = await make_user(email=f"target-{uniq}@example.com")

    resp = await client.patch(
        f"/api/admin/users/{target.id}",
        json={
            "full_name": "Renamed User",
            "username": f"Renamed-{uniq}",
            "email": f"renamed-{uniq}@example.com",
            "role": "admin",
            "password": "NewPass456",
        },
        headers=admin_headers,
    )

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["full_name"] == "Renamed User"
    assert data["username"] == f"renamed-{uniq}"  # normalized, as on create
    assert data["email"] == f"renamed-{uniq}@example.com"
    assert data["role"] == "admin"

    login = await client.post(
        "/api/auth/login", json={"username": f"renamed-{uniq}", "password": "NewPass456"}
    )
    assert login.status_code == 200


async def test_patch_user_can_clear_the_email(client, admin_headers, make_user, uniq):
    target, _ = await make_user(email=f"target-{uniq}@example.com")

    resp = await client.patch(
        f"/api/admin/users/{target.id}", json={"email": None}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["email"] is None


async def test_patch_user_may_resend_its_own_username(client, admin_headers, make_user, uniq):
    """The edit form sends every field; a user's own values are not a clash."""
    target, _ = await make_user(email=f"target-{uniq}@example.com")

    resp = await client.patch(
        f"/api/admin/users/{target.id}",
        json={"username": target.username, "email": target.email},
        headers=admin_headers,
    )

    assert resp.status_code == 200


async def test_patch_user_duplicate_username(client, admin_headers, make_user, uniq):
    other, _ = await make_user(email=f"taken-{uniq}@example.com")
    target, _ = await make_user(email=f"target-{uniq}@example.com")

    resp = await client.patch(
        f"/api/admin/users/{target.id}", json={"username": other.username}, headers=admin_headers
    )

    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "USERNAME_EXISTS"


async def test_patch_user_duplicate_email(client, admin_headers, make_user, uniq):
    other, _ = await make_user(email=f"taken-{uniq}@example.com")
    target, _ = await make_user(email=f"target-{uniq}@example.com")

    resp = await client.patch(
        f"/api/admin/users/{target.id}", json={"email": other.email}, headers=admin_headers
    )

    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "EMAIL_EXISTS"


async def test_patch_user_rejects_an_invalid_username(client, admin_headers, make_user, uniq):
    target, _ = await make_user(email=f"target-{uniq}@example.com")

    resp = await client.patch(
        f"/api/admin/users/{target.id}", json={"username": "a b!"}, headers=admin_headers
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_patch_user_requires_admin(client, employee_headers, make_user, uniq):
    target, _ = await make_user(email=f"target-{uniq}@example.com")

    resp = await client.patch(
        f"/api/admin/users/{target.id}", json={"full_name": "Nope"}, headers=employee_headers
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


# --------------------------------------------------------------------------
# Deletion (CH-01)
# --------------------------------------------------------------------------


async def test_delete_user_happy_path(client, admin_headers, make_user, uniq):
    target, _ = await make_user(email=f"deleteme-{uniq}@example.com")

    resp = await client.delete(f"/api/admin/users/{target.id}", headers=admin_headers)

    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True

    listed = await client.get(
        "/api/admin/users", params={"search": target.email}, headers=admin_headers
    )
    assert all(item["id"] != str(target.id) for item in listed.json()["data"]["items"])


async def test_delete_user_requires_admin(client, employee_headers, make_user, uniq):
    target, _ = await make_user(email=f"deleteme-{uniq}@example.com")

    resp = await client.delete(f"/api/admin/users/{target.id}", headers=employee_headers)

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_delete_user_requires_auth(client, make_user, uniq):
    target, _ = await make_user(email=f"deleteme-{uniq}@example.com")

    resp = await client.delete(f"/api/admin/users/{target.id}")

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_delete_unknown_user(client, admin_headers):
    resp = await client.delete(
        "/api/admin/users/00000000-0000-0000-0000-000000000000", headers=admin_headers
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


async def test_admin_cannot_delete_themselves(client, admin_headers, admin_user):
    """Self-deletion signs the admin out of a tool only they can administer."""
    user, _password = admin_user

    resp = await client.delete(f"/api/admin/users/{user.id}", headers=admin_headers)

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "CANNOT_DELETE_SELF"


async def test_deleting_a_users_records_keeps_them_but_drops_attribution(
    client, admin_headers, make_user, uniq
):
    """created_by is ON DELETE SET NULL — the work survives, the name does not."""
    author, password = await make_user(
        email=f"author-{uniq}@example.com", full_name="Departing Employee"
    )
    login = await client.post(
        "/api/auth/login", json={"username": author.username, "password": password}
    )
    author_headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}

    created = await client.post(
        "/api/clients",
        json={
            "contact_person_name": "Orphaned Contact",
            "company_name": f"Orphaned Co {uniq}",
            "contact_number": "9876543210",
            "email": f"orphan-{uniq}@example.com",
        },
        headers=author_headers,
    )
    client_row_id = created.json()["data"]["id"]

    await client.delete(f"/api/admin/users/{author.id}", headers=admin_headers)

    resp = await client.get(f"/api/clients/{client_row_id}", headers=admin_headers)
    assert resp.status_code == 200
    assert resp.json()["data"]["created_by"] is None


# --------------------------------------------------------------------------
# User directory (CH-37) — names for the "Added/Updated By" filter
# --------------------------------------------------------------------------


async def test_directory_is_readable_by_an_employee(
    client, employee_headers, employee_user, make_user, uniq
):
    inactive, _ = await make_user(
        email=f"gone-{uniq}@example.com", full_name=f"Former Employee {uniq}", is_active=False
    )

    resp = await client.get("/api/users", headers=employee_headers)

    assert resp.status_code == 200
    entries = {entry["id"]: entry for entry in resp.json()["data"]}
    assert entries[str(employee_user[0].id)]["full_name"] == "Test User"
    # Deactivated accounts stay listed: the rows they touched still carry their name.
    assert entries[str(inactive.id)]["is_active"] is False


async def test_directory_exposes_names_only(client, employee_headers):
    """Readable by every role, so nothing beyond what the tables already print."""
    resp = await client.get("/api/users", headers=employee_headers)

    entry = resp.json()["data"][0]
    assert set(entry) == {"id", "full_name", "is_active"}


async def test_directory_requires_auth(client):
    resp = await client.get("/api/users")

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"
