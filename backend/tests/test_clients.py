"""Client CRUD + the PRD section 3.3 ownership matrix.

These run against a database that already holds committed demo data, so every
row a test creates is uniquely named and assertions check membership rather
than absolute counts. See the `uniq` fixture in conftest.
"""


def client_payload(uniq: str, **overrides) -> dict:
    return {
        "contact_person_name": "Rohan Mehta",
        "company_name": f"Mehta Constructions {uniq}",
        "contact_number": "+91 98765 43210",
        "email": f"rohan-{uniq}@mehtaconstructions.com",
        **overrides,
    }


async def _create_client(client, headers, uniq, **overrides):
    return await client.post(
        "/api/clients", json=client_payload(uniq, **overrides), headers=headers
    )


async def test_create_client_happy_path(client, employee_headers, uniq):
    resp = await _create_client(client, employee_headers, uniq)

    assert resp.status_code == 201
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["email"] == f"rohan-{uniq}@mehtaconstructions.com"
    # created_by is server-set from the JWT, never from the request body
    assert body["data"]["created_by"]["full_name"] == "Test User"


async def test_create_client_requires_auth(client, uniq):
    resp = await client.post("/api/clients", json=client_payload(uniq))

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_create_client_validation_error(client, employee_headers, uniq):
    resp = await _create_client(client, employee_headers, uniq, email="not-an-email")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_client_rejects_bad_contact_number(client, employee_headers, uniq):
    resp = await _create_client(client, employee_headers, uniq, contact_number="abc")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_create_client_duplicate_email(client, employee_headers, uniq):
    await _create_client(client, employee_headers, uniq)
    resp = await _create_client(client, employee_headers, uniq, company_name="Another Co")

    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "EMAIL_EXISTS"


async def test_create_client_ignores_client_supplied_created_by(client, employee_headers, uniq):
    """created_by must come from the JWT, never the request body."""
    resp = await client.post(
        "/api/clients",
        json=client_payload(uniq, created_by="00000000-0000-0000-0000-000000000000"),
        headers=employee_headers,
    )

    assert resp.status_code == 201
    assert resp.json()["data"]["created_by"]["full_name"] == "Test User"


async def test_list_clients_includes_created_row(client, employee_headers, uniq):
    before = (await client.get("/api/clients", headers=employee_headers)).json()["data"]
    await _create_client(client, employee_headers, uniq)

    resp = await client.get("/api/clients", headers=employee_headers)

    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["page"] == 1
    assert body["page_size"] == 25
    assert body["total_count"] == before["total_count"] + 1


async def test_list_clients_search_filters(client, employee_headers, uniq):
    await _create_client(client, employee_headers, uniq)
    await _create_client(
        client,
        employee_headers,
        uniq,
        company_name=f"Sharma Traders {uniq}",
        email=f"sunita-{uniq}@sharmatraders.com",
    )

    resp = await client.get(
        "/api/clients", params={"search": f"Sharma Traders {uniq}"}, headers=employee_headers
    )

    body = resp.json()["data"]
    assert body["total_count"] == 1
    assert body["items"][0]["company_name"] == f"Sharma Traders {uniq}"


async def test_get_client_not_found(client, employee_headers):
    resp = await client.get(
        "/api/clients/00000000-0000-0000-0000-000000000000", headers=employee_headers
    )

    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "NOT_FOUND"


async def test_update_own_client(client, employee_headers, uniq):
    created = await _create_client(client, employee_headers, uniq)
    client_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/clients/{client_id}",
        json={"company_name": f"Mehta Constructions Pvt Ltd {uniq}"},
        headers=employee_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["company_name"] == f"Mehta Constructions Pvt Ltd {uniq}"


async def test_employee_cannot_update_others_client(
    client, employee_headers, other_employee_headers, uniq
):
    created = await _create_client(client, employee_headers, uniq)
    client_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/clients/{client_id}",
        json={"company_name": "Hijacked"},
        headers=other_employee_headers,
    )

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_employee_cannot_delete_others_client(
    client, employee_headers, other_employee_headers, uniq
):
    created = await _create_client(client, employee_headers, uniq)
    client_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/clients/{client_id}", headers=other_employee_headers)

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_admin_can_update_others_client(client, employee_headers, admin_headers, uniq):
    created = await _create_client(client, employee_headers, uniq)
    client_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/clients/{client_id}", json={"company_name": "Admin Edited"}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["company_name"] == "Admin Edited"


async def test_delete_own_client(client, employee_headers, uniq):
    created = await _create_client(client, employee_headers, uniq)
    client_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/clients/{client_id}", headers=employee_headers)

    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True

    follow_up = await client.get(f"/api/clients/{client_id}", headers=employee_headers)
    assert follow_up.status_code == 404
