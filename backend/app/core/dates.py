"""Date helpers for the app's single reporting timezone.

Every timestamp is stored in UTC (`timestamptz`, written by `now()`), but the
people using this tool think in IST, and the frontend already renders dates in
Asia/Kolkata (PRD section 5). Anything that turns "now" into a calendar day —
such as the default for a tender's date (CH-22) — has to mean the IST day, or a
tender logged at 01:00 IST would land on the previous day.

IST is a fixed +05:30 offset with no DST — it has never observed one — so this
uses a plain offset rather than a zoneinfo lookup, which keeps the backend from
needing the `tzdata` package on platforms that ship no system tz database.
"""

from datetime import date, datetime, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30), name="IST")


def today_ist() -> date:
    """The current calendar day in IST."""
    return datetime.now(IST).date()
