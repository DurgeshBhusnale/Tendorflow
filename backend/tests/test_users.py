async def test_create_user_happy_path(client, admin_headers):
    resp = await client.post(
        "/api/admin/users",
        json={
            "full_name": "New Employee",
            "email": "new.employee@example.com",
            "password": "Password123",
            "role": "employee",
        },
        headers=admin_headers,
    )

    assert resp.status_code == 201
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["email"] == "new.employee@example.com"
    assert body["data"]["role"] == "employee"
    assert "password" not in body["data"]


async def test_create_user_requires_auth(client):
    resp = await client.post(
        "/api/admin/users",
        json={
            "full_name": "New Employee",
            "email": "new.employee@example.com",
            "password": "Password123",
            "role": "employee",
        },
    )

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_create_user_requires_admin(client, employee_headers):
    resp = await client.post(
        "/api/admin/users",
        json={
            "full_name": "New Employee",
            "email": "new.employee@example.com",
            "password": "Password123",
            "role": "employee",
        },
        headers=employee_headers,
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_create_user_duplicate_email(client, admin_headers, make_user):
    existing, _ = await make_user(email="dup@example.com")

    resp = await client.post(
        "/api/admin/users",
        json={
            "full_name": "Someone Else",
            "email": existing.email,
            "password": "Password123",
            "role": "employee",
        },
        headers=admin_headers,
    )

    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "EMAIL_EXISTS"


async def test_create_user_weak_password(client, admin_headers):
    resp = await client.post(
        "/api/admin/users",
        json={
            "full_name": "New Employee",
            "email": "weakpass@example.com",
            "password": "short",
            "role": "employee",
        },
        headers=admin_headers,
    )

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_list_users_happy_path(client, admin_headers):
    resp = await client.get("/api/admin/users", headers=admin_headers)

    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["page"] == 1
    assert body["page_size"] == 25
    assert any(item["email"] == "admin@example.com" for item in body["items"])


async def test_patch_user_toggles_active(client, admin_headers, make_user):
    target, _ = await make_user(email="target@example.com")

    resp = await client.patch(
        f"/api/admin/users/{target.id}",
        json={"is_active": False},
        headers=admin_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["is_active"] is False
