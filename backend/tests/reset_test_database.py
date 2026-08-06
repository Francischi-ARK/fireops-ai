import asyncio
import os
from urllib.parse import urlparse

from psycopg import AsyncConnection

from fireguard_backend.repository import PostgresRepository


async def main():
    dsn = os.environ["FIREGUARD_TEST_DATABASE_URL"]
    if urlparse(dsn).path != "/fireguard_test":
        raise SystemExit("refusing to reset a database other than fireguard_test")
    async with await AsyncConnection.connect(dsn) as connection:
        await connection.execute("DROP SCHEMA public CASCADE")
        await connection.execute("CREATE SCHEMA public")
    await PostgresRepository(dsn).init()


if __name__ == "__main__":
    asyncio.run(main())
