import pytest

VALID_CLIENT = {
    "contact_person_name": "Rohan Mehta",
    "company_name": "Mehta Constructions",
    "contact_number": "+91 98765 43210",
    "email": "rohan@mehta.com",
}


@pytest.fixture
async def other_employee_headers(client, make_user):
    """A second, distinct employee — for cross-ownership permission tests."""
    user, password = await make_user(email="other.employee@example.com", role="employee")
    resp = await client.post("/api/auth/login", json={"email": user.email, "password": password})
    token = resp.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _create_client(client, headers, **overrides):
    payload = {**VALID_CLIENT, **overrides}
    resp = await client.post("/api/clients", json=payload, headers=headers)
    return resp


async def test_create_client_happy_path(client, employee_headers):
    resp = await _create_client(client, employee_headers)

    assert resp.status_code == 201
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["email"] == "rohan@mehta.com"
    # created_by is server-set from the JWT, never from the request body
    assert body["data"]["created_by"]["full_name"] == "Test User"


async def test_create_client_requires_auth(client):
    resp = await client.post("/api/clients", json=VALID_CLIENT)

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_create_client_validation_error(client, employee_headers):
    resp = await _create_client(client, employee_headers, email="not-an-email")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_client_rejects_bad_contact_number(client, employee_headers):
    resp = await _create_client(client, employee_headers, contact_number="abc")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_client_duplicate_email(client, employee_headers):
    await _create_client(client, employee_headers)
    resp = await _create_client(client, employee_headers, company_name="Another Co")

    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "EMAIL_EXISTS"


async def test_create_client_ignores_client_supplied_created_by(client, employee_headers):
    """created_by must come from the JWT, never the request body."""
    resp = await client.post(
        "/api/clients",
        json={**VALID_CLIENT, "created_by": "00000000-0000-0000-0000-000000000000"},
        headers=employee_headers,
    )

    assert resp.status_code == 201
    assert resp.json()["data"]["created_by"]["full_name"] == "Test User"


async def test_list_clients_happy_path(client, employee_headers):
    await _create_client(client, employee_headers)

    resp = await client.get("/api/clients", headers=employee_headers)

    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["page"] == 1
    assert body["page_size"] == 25
    assert body["total_count"] == 1
    assert body["items"][0]["email"] == "rohan@mehta.com"


async def test_list_clients_search_filters(client, employee_headers):
    await _create_client(client, employee_headers)
    await _create_client(
        client, employee_headers, company_name="Sharma Traders", email="s@sharma.com"
    )

    resp = await client.get("/api/clients", params={"search": "Sharma"}, headers=employee_headers)

    body = resp.json()["data"]
    assert body["total_count"] == 1
    assert body["items"][0]["company_name"] == "Sharma Traders"


async def test_get_client_not_found(client, employee_headers):
    resp = await client.get(
        "/api/clients/00000000-0000-0000-0000-000000000000", headers=employee_headers
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


async def test_update_own_client(client, employee_headers):
    created = await _create_client(client, employee_headers)
    client_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/clients/{client_id}",
        json={"company_name": "Mehta Constructions Pvt Ltd"},
        headers=employee_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["company_name"] == "Mehta Constructions Pvt Ltd"


async def test_employee_cannot_update_others_client(
    client, employee_headers, other_employee_headers
):
    created = await _create_client(client, employee_headers)
    client_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/clients/{client_id}",
        json={"company_name": "Hijacked"},
        headers=other_employee_headers,
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_employee_cannot_delete_others_client(
    client, employee_headers, other_employee_headers
):
    created = await _create_client(client, employee_headers)
    client_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/clients/{client_id}", headers=other_employee_headers)

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_admin_can_update_others_client(client, employee_headers, admin_headers):
    created = await _create_client(client, employee_headers)
    client_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/clients/{client_id}", json={"company_name": "Admin Edited"}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["company_name"] == "Admin Edited"


async def test_delete_own_client(client, employee_headers):
    created = await _create_client(client, employee_headers)
    client_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/clients/{client_id}", headers=employee_headers)

    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True

    follow_up = await client.get(f"/api/clients/{client_id}", headers=employee_headers)
    assert follow_up.status_code == 404
