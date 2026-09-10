"""Validation primitives shared across schemas.

Anything enforced on more than one resource lives here so the rule has exactly
one definition. Mirrored on the frontend in `src/lib/validation.ts` — the two
are duplicated deliberately (root CLAUDE.md, monorepo split rules), so a change
here needs the same change there.
"""

import re

# Indian mobile numbers: ten digits, first digit 6-9. Callers may type the
# country code or a trunk '0', and may space or dash the number however they
# like; all of that is stripped before the check and the stored value is the
# bare ten digits (CH-17).
_PHONE_STRIP_RE = re.compile(r"[\s\-()]")
_PHONE_RE = re.compile(r"^[6-9]\d{9}$")

USERNAME_RE = re.compile(r"^[a-z0-9._-]{3,30}$")


def normalize_phone(value: str) -> str:
    """Strip formatting and any +91 / 0 prefix, then validate as an Indian mobile.

    Returns the canonical ten-digit form. Raises ValueError with a message the
    frontend can show verbatim.
    """
    digits = _PHONE_STRIP_RE.sub("", value)
    if digits.startswith("+91"):
        digits = digits[3:]
    elif digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    elif digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]

    if not _PHONE_RE.match(digits):
        raise ValueError("Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9.")
    return digits


def normalize_username(value: str) -> str:
    """Lowercase and validate a login username.

    Case-folded so that `Asha` and `asha` can never become two accounts — the
    unique index is on the stored value, and login looks up the same way.
    """
    candidate = value.strip().lower()
    if not USERNAME_RE.match(candidate):
        raise ValueError(
            "Username must be 3-30 characters using lowercase letters, digits, "
            "dot, underscore or hyphen."
        )
    return candidate
