"""Date-boundary helpers for the app's single reporting timezone.

Every timestamp is stored in UTC (`timestamptz`, written by `now()`), but the
people using this tool think in IST, and the frontend already renders dates in
Asia/Kolkata (PRD section 5). A date-range filter therefore has to mean "IST
calendar days", or a tender logged at 09:00 IST on the 1st would fall outside a
range starting on the 1st.

IST is a fixed +05:30 offset with no DST — it has never observed one — so this
uses a plain offset rather than a zoneinfo lookup, which keeps the backend from
needing the `tzdata` package on platforms that ship no system tz database.
"""

from datetime import UTC, date, datetime, time, timedelta, timezone

IST = timezone(timedelta(hours=5, minutes=30), name="IST")


def ist_day_start_utc(day: date) -> datetime:
    """The first instant of an IST calendar day, as a UTC-aware datetime."""
    return datetime.combine(day, time.min, tzinfo=IST).astimezone(UTC)


def ist_day_end_utc(day: date) -> datetime:
    """The first instant *after* an IST calendar day, as a UTC-aware datetime.

    Exclusive upper bound: compare with `<`, so the filter includes everything
    logged during `day` itself without depending on timestamp precision.
    """
    return ist_day_start_utc(day + timedelta(days=1))
