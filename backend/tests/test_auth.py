"""Authentication.

Sign-in is by username, not email (CH-02). Email is still stored and returned,
but it is not a credential.
"""


async def test_login_happy_path(client, make_user, uniq):
    user, password = await make_user(email=f"asha-{uniq}@example.com", password="Password123")

    resp = await client.post(
        "/api/auth/login", json={"username": user.username, "password": password}
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["access_token"]
    assert body["data"]["refresh_token"]
    assert body["data"]["user"]["username"] == user.username
    assert body["data"]["user"]["email"] == user.email


async def test_login_is_case_insensitive_on_username(client, make_user, uniq):
    """Usernames are stored folded, so 'Asha' and 'asha' are the same account."""
    user, password = await make_user(username=f"asha-{uniq}", email=f"asha-{uniq}@example.com")

    resp = await client.post(
        "/api/auth/login", json={"username": user.username.upper(), "password": password}
    )

    assert resp.status_code == 200


async def test_login_with_email_is_rejected(client, make_user, uniq):
    """The email is no longer a credential; presenting it must not sign anyone in."""
    user, password = await make_user(email=f"asha-{uniq}@example.com", password="Password123")

    resp = await client.post("/api/auth/login", json={"username": user.email, "password": password})

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


async def test_login_invalid_credentials(client, make_user, uniq):
    user, _password = await make_user(email=f"asha-{uniq}@example.com", password="Password123")

    resp = await client.post(
        "/api/auth/login", json={"username": user.username, "password": "WrongPass1"}
    )

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


async def test_login_unknown_username_looks_the_same_as_a_wrong_password(client):
    """Same code and message either way, so the response can't enumerate accounts."""
    resp = await client.post(
        "/api/auth/login", json={"username": "nobody-at-all", "password": "Password123"}
    )

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


async def test_login_inactive_account(client, make_user, uniq):
    user, password = await make_user(
        email=f"inactive-{uniq}@example.com", password="Password123", is_active=False
    )

    resp = await client.post(
        "/api/auth/login", json={"username": user.username, "password": password}
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "ACCOUNT_INACTIVE"


async def test_login_validation_error(client):
    resp = await client.post("/api/auth/login", json={"password": "Password123"})

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_refresh_happy_path(client, make_user, uniq):
    user, password = await make_user(email=f"asha-{uniq}@example.com", password="Password123")
    login_resp = await client.post(
        "/api/auth/login", json={"username": user.username, "password": password}
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


async def test_me_happy_path(client, employee_headers, employee_user):
    user, _password = employee_user

    resp = await client.get("/api/auth/me", headers=employee_headers)

    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["username"] == user.username
    assert data["email"] == user.email
