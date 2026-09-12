"""Admin user management.

Onboarding takes a username as well as an email (CH-02), and users can now be
deleted outright rather than only deactivated (CH-01) — with two guards, since
either mistake locks people out of the tool in a way the UI cannot undo.
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


async def test_create_user_requires_an_email(client, admin_headers, uniq):
    payload = _payload(uniq)
    del payload["email"]

    resp = await client.post("/api/admin/users", json=payload, headers=admin_headers)

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
