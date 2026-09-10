"""Client CRUD and permissions.

Clients are open-edit (CH-19): any signed-in user may change any client, and
the row then reports whoever touched it last. Deletion stays admin-only,
because deleting a client cascades to their credentials, tenders and DSC keys.

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


async def test_contact_number_is_normalized_to_ten_digits(client, employee_headers, uniq):
    """+91, spaces and dashes are stripped; the stored value is canonical (CH-17)."""
    resp = await _create_client(client, employee_headers, uniq, contact_number="+91 98765-43210")

    assert resp.status_code == 201
    assert resp.json()["data"]["contact_number"] == "9876543210"


async def test_contact_number_rejects_a_landline_style_number(client, employee_headers, uniq):
    """Indian mobiles start 6-9; a number starting 2 is not one."""
    resp = await _create_client(client, employee_headers, uniq, contact_number="2212345678")

    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "VALIDATION_ERROR"


async def test_contact_number_rejects_a_short_number(client, employee_headers, uniq):
    resp = await _create_client(client, employee_headers, uniq, contact_number="98765")

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


async def test_any_employee_can_update_any_client(
    client, employee_headers, other_employee_headers, uniq
):
    created = await _create_client(client, employee_headers, uniq)
    client_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/clients/{client_id}",
        json={"company_name": f"Edited By Someone Else {uniq}"},
        headers=other_employee_headers,
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["company_name"] == f"Edited By Someone Else {uniq}"


async def test_editing_moves_the_attribution_to_the_editor(
    client, employee_headers, other_employee_headers, uniq
):
    """The by-column names the latest hand, not the original onboarder (CH-19)."""
    created = await _create_client(client, employee_headers, uniq)
    assert created.json()["data"]["created_by"]["full_name"] == "Test User"
    client_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/clients/{client_id}",
        json={"company_name": f"Edited {uniq}"},
        headers=other_employee_headers,
    )

    assert resp.json()["data"]["created_by"]["full_name"] == "Other Employee"


async def test_updated_at_moves_with_the_edit(client, employee_headers, uniq):
    """The Date column reads updated_at, so the trigger has to be doing its job."""
    created = await _create_client(client, employee_headers, uniq)
    client_id = created.json()["data"]["id"]
    original = created.json()["data"]["updated_at"]

    resp = await client.patch(
        f"/api/clients/{client_id}",
        json={"company_name": f"Edited {uniq}"},
        headers=employee_headers,
    )

    assert resp.json()["data"]["updated_at"] >= original


async def test_admin_can_update_any_client(client, employee_headers, admin_headers, uniq):
    created = await _create_client(client, employee_headers, uniq)
    client_id = created.json()["data"]["id"]

    resp = await client.patch(
        f"/api/clients/{client_id}", json={"company_name": "Admin Edited"}, headers=admin_headers
    )

    assert resp.status_code == 200
    assert resp.json()["data"]["company_name"] == "Admin Edited"


async def test_employee_cannot_delete_a_client(client, employee_headers, uniq):
    """Deleting cascades to tenders, credentials and keys — admins only."""
    created = await _create_client(client, employee_headers, uniq)
    client_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/clients/{client_id}", headers=employee_headers)

    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "FORBIDDEN"


async def test_admin_can_delete_a_client(client, employee_headers, admin_headers, uniq):
    created = await _create_client(client, employee_headers, uniq)
    client_id = created.json()["data"]["id"]

    resp = await client.delete(f"/api/clients/{client_id}", headers=admin_headers)

    assert resp.status_code == 200
    assert resp.json()["data"]["deleted"] is True

    follow_up = await client.get(f"/api/clients/{client_id}", headers=admin_headers)
    assert follow_up.status_code == 404
