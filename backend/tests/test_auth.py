async def test_login_happy_path(client, make_user):
    user, password = await make_user(email="asha@example.com", password="Password123")

    resp = await client.post("/api/auth/login", json={"email": user.email, "password": password})

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["access_token"]
    assert body["data"]["refresh_token"]
    assert body["data"]["user"]["email"] == user.email


async def test_login_invalid_credentials(client, make_user):
    user, _password = await make_user(email="asha@example.com", password="Password123")

    resp = await client.post(
        "/api/auth/login", json={"email": user.email, "password": "WrongPass1"}
    )

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


async def test_login_inactive_account(client, make_user):
    user, password = await make_user(
        email="inactive@example.com", password="Password123", is_active=False
    )

    resp = await client.post("/api/auth/login", json={"email": user.email, "password": password})

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "ACCOUNT_INACTIVE"


async def test_login_validation_error(client):
    resp = await client.post("/api/auth/login", json={"email": "not-an-email", "password": ""})

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_refresh_happy_path(client, make_user):
    user, password = await make_user(email="asha@example.com", password="Password123")
    login_resp = await client.post(
        "/api/auth/login", json={"email": user.email, "password": password}
    )
    refresh_token = login_resp.json()["data"]["refresh_token"]

    resp = await client.post("/api/auth/refresh", json={"refresh_token": refresh_token})

    assert resp.status_code == 200
    assert resp.json()["data"]["access_token"]


async def test_refresh_invalid_token(client):
    resp = await client.post("/api/auth/refresh", json={"refresh_token": "not-a-real-token"})

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_REFRESH_TOKEN"


async def test_me_requires_auth(client):
    resp = await client.get("/api/auth/me")

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_me_happy_path(client, employee_headers):
    resp = await client.get("/api/auth/me", headers=employee_headers)

    assert resp.status_code == 200
    assert resp.json()["data"]["email"] == "employee@example.com"
