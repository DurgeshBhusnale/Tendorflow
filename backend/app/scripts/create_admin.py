import asyncio
import getpass

from sqlalchemy import or_, select

from app.core.auth import hash_password
from app.database import async_session_maker
from app.models.user import User
from app.schemas.user import validate_password_policy
from app.schemas.validators import normalize_username


async def main() -> None:
    print("Bootstrap the first Admin user.")
    full_name = input("Full name: ").strip()
    username = input("Username (used to sign in): ").strip()
    email = input("Email: ").strip()
    password = getpass.getpass("Password: ")
    confirm = getpass.getpass("Confirm password: ")

    if password != confirm:
        print("Passwords do not match.")
        return

    try:
        username = normalize_username(username)
    except ValueError as exc:
        print(f"Invalid username: {exc}")
        return

    try:
        validate_password_policy(password)
    except ValueError as exc:
        print(f"Invalid password: {exc}")
        return

    async with async_session_maker() as session:
        existing = await session.scalar(
            select(User).where(or_(User.username == username, User.email == email))
        )
        if existing is not None:
            taken = "username" if existing.username == username else "email"
            print(f"A user with that {taken} already exists.")
            return

        user = User(
            full_name=full_name,
            username=username,
            email=email,
            password_hash=hash_password(password),
            role="admin",
        )
        session.add(user)
        await session.commit()
        print(f"Admin created: {username}")


if __name__ == "__main__":
    asyncio.run(main())
