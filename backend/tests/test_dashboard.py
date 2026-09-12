"""Dashboard aggregation.

The database already holds committed demo data, so every metric is asserted
as a delta against a baseline taken at the start of the test rather than an
absolute number.
"""

import pytest


@pytest.fixture
async def client_id(client, employee_headers, uniq) -> str:
    resp = await client.post(
        "/api/clients",
        json={
            "contact_person_name": "Rohan Mehta",
            "company_name": f"Mehta Constructions {uniq}",
            "contact_number": "+91 98765 43210",
            "email": f"rohan-{uniq}@mehtaconstructions.com",
        },
        headers=employee_headers,
    )
    return resp.json()["data"]["id"]


@pytest.fixture
async def tender_department_id(client, admin_headers, uniq) -> str:
    resp = await client.post(
        "/api/tender-departments", json={"name": f"Civil-Works-{uniq}"}, headers=admin_headers
    )
    return resp.json()["data"]["id"]


async def _summary(client, headers) -> dict:
    resp = await client.get("/api/dashboard/summary", headers=headers)
    assert resp.status_code == 200
    return resp.json()["data"]


async def test_summary_requires_auth(client):
    resp = await client.get("/api/dashboard/summary")

    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"


async def test_summary_shape(client, admin_headers):
    data = await _summary(client, admin_headers)

    assert set(data) == {
        "total_active_clients",
        "pending_tenders_count",
        "total_paid_tender_value",
        "dsc_keys_in_office",
        "recent_tenders",
        "recent_clients",
    }
    assert isinstance(data["total_paid_tender_value"], str)


async def test_employee_can_view_dashboard(client, employee_headers):
    data = await _summary(client, employee_headers)

    assert isinstance(data["total_active_clients"], int)


async def test_paid_tender_value_is_withheld_from_employees(client, employee_headers):
    """Revenue is admin-only (CH-12).

    The key stays present and null rather than disappearing, so the response
    shape is the same for both roles and the UI drops a card instead of
    branching on a missing field.
    """
    data = await _summary(client, employee_headers)

    assert "total_paid_tender_value" in data
    assert data["total_paid_tender_value"] is None


async def test_paid_tender_value_is_visible_to_admins(client, admin_headers):
    data = await _summary(client, admin_headers)

    assert isinstance(data["total_paid_tender_value"], str)


async def test_admin_can_view_dashboard(client, admin_headers):
    data = await _summary(client, admin_headers)

    assert isinstance(data["total_active_clients"], int)


async def test_adding_a_client_increments_the_client_count(client, employee_headers, client_id):
    """`client_id` fixture created one client, so the count must have moved by 1."""
    before = await _summary(client, employee_headers)
    await client.post(
        "/api/clients",
        json={
            "contact_person_name": "Second Person",
            "company_name": "Second Co",
            "contact_number": "9000000001",
            "email": "second-dashboard-check@example.com",
        },
        headers=employee_headers,
    )

    after = await _summary(client, employee_headers)

    assert after["total_active_clients"] == before["total_active_clients"] + 1


async def test_pending_tender_moves_between_metrics_when_paid(
    client, admin_headers, employee_headers, client_id, tender_department_id
):
    """Marking a tender Paid must drop the pending count and raise the paid value.

    Read as an admin throughout, since the paid value is withheld from
    employees.
    """
    before = await _summary(client, admin_headers)

    created = await client.post(
        "/api/tenders",
        json={
            "client_id": client_id,
            "tender_department_id": tender_department_id,
            "quantity": 2,
            "price": "1000.00",
        },
        headers=employee_headers,
    )
    tender_id = created.json()["data"]["id"]

    with_pending = await _summary(client, admin_headers)
    assert with_pending["pending_tenders_count"] == before["pending_tenders_count"] + 1
    assert with_pending["total_paid_tender_value"] == before["total_paid_tender_value"]

    await client.patch(
        f"/api/tenders/{tender_id}",
        json={"status": "Paid", "payment_mode": "Cash"},
        headers=employee_headers,
    )

    after = await _summary(client, admin_headers)
    assert after["pending_tenders_count"] == before["pending_tenders_count"]
    assert float(after["total_paid_tender_value"]) == pytest.approx(
        float(before["total_paid_tender_value"]) + 2000.00
    )


async def test_partially_paid_tender_leaves_the_pending_count(
    client, admin_headers, employee_headers, client_id, tender_department_id
):
    """Partially Paid is its own status: it is neither pending nor settled."""
    before = await _summary(client, admin_headers)

    await client.post(
        "/api/tenders",
        json={
            "client_id": client_id,
            "tender_department_id": tender_department_id,
            "quantity": 2,
            "price": "1000.00",
            "status": "Partially Paid",
            "paid_amount": "500.00",
            "payment_mode": "Online",
        },
        headers=employee_headers,
    )

    after = await _summary(client, admin_headers)
    assert after["pending_tenders_count"] == before["pending_tenders_count"]
    assert after["total_paid_tender_value"] == before["total_paid_tender_value"]


@pytest.mark.parametrize(
    ("status", "counts_as_in_office"),
    [
        ("Key Created", True),
        ("Key Returned", True),
        ("Key Issued", False),
    ],
)
async def test_dsc_in_office_metric_counts_only_present_keys(
    client, employee_headers, client_id, status, counts_as_in_office
):
    before = await _summary(client, employee_headers)

    await client.post(
        "/api/dsc",
        json={"client_id": client_id, "key_status": status},
        headers=employee_headers,
    )

    after = await _summary(client, employee_headers)
    expected = before["dsc_keys_in_office"] + (1 if counts_as_in_office else 0)
    assert after["dsc_keys_in_office"] == expected


async def test_recent_lists_are_capped_at_five(
    client, employee_headers, client_id, tender_department_id, uniq
):
    """Create more than five of each so the cap has to engage.

    Both counts are built inside the test rather than relying on however many
    demo rows happen to exist.
    """
    for n in range(6):
        await client.post(
            "/api/tenders",
            json={
                "client_id": client_id,
                "tender_department_id": tender_department_id,
                "quantity": n + 1,
                "price": "10.00",
            },
            headers=employee_headers,
        )
        await client.post(
            "/api/clients",
            json={
                "contact_person_name": f"Person {n}",
                "company_name": f"Cap Check Co {n} {uniq}",
                "contact_number": "+91 90000 00002",
                "email": f"cap-check-{n}-{uniq}@example.com",
            },
            headers=employee_headers,
        )

    data = await _summary(client, employee_headers)

    assert len(data["recent_tenders"]) == 5
    assert len(data["recent_clients"]) == 5


async def test_recent_lists_are_newest_first(client, employee_headers, client_id):
    data = await _summary(client, employee_headers)

    created_ats = [c["created_at"] for c in data["recent_clients"]]
    assert created_ats == sorted(created_ats, reverse=True)
    # the client just created by the fixture should lead the list
    assert data["recent_clients"][0]["id"] == client_id


async def test_recent_rows_match_the_list_endpoint_shape(
    client, employee_headers, client_id, tender_department_id
):
    """Panels reuse the module list shapes, so both sides stay in sync."""
    await client.post(
        "/api/tenders",
        json={
            "client_id": client_id,
            "tender_department_id": tender_department_id,
            "quantity": 2,
            "price": "1000.00",
        },
        headers=employee_headers,
    )

    data = await _summary(client, employee_headers)
    listed = (await client.get("/api/tenders", headers=employee_headers)).json()["data"]["items"]

    assert set(data["recent_tenders"][0]) == set(listed[0])
    assert data["recent_tenders"][0]["total_amount"] == "2000.00"
