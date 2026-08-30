import asyncio
import getpass

from sqlalchemy import select

from app.core.auth import hash_password
from app.database import async_session_maker
from app.models.user import User
from app.schemas.user import validate_password_policy


async def main() -> None:
    print("Bootstrap the first Admin user.")
    full_name = input("Full name: ").strip()
    email = input("Email: ").strip()
    password = getpass.getpass("Password: ")
    confirm = getpass.getpass("Confirm password: ")

    if password != confirm:
        print("Passwords do not match.")
        return

    try:
        validate_password_policy(password)
    except ValueError as exc:
        print(f"Invalid password: {exc}")
        return

    async with async_session_maker() as session:
        existing = await session.scalar(select(User).where(User.email == email))
        if existing is not None:
            print(f"A user with email {email} already exists.")
            return

        user = User(
            full_name=full_name,
            email=email,
            password_hash=hash_password(password),
            role="admin",
        )
        session.add(user)
        await session.commit()
        print(f"Admin created: {email}")


if __name__ == "__main__":
    asyncio.run(main())
