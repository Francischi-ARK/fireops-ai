import asyncio
import os
from urllib.parse import urlparse

from psycopg import AsyncConnection

from fireguard_backend.repository import PostgresRepository


DEFAULT_DSN = "postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard"


async def main():
    dsn = os.getenv("FIREGUARD_DATABASE_URL") or os.getenv("DATABASE_URL") or DEFAULT_DSN
    parsed = urlparse(dsn)
    if (
        parsed.path != "/fireguard"
        or parsed.hostname not in {"127.0.0.1", "localhost"}
        or parsed.port != 54330
    ):
        raise SystemExit("refusing to reset anything except local fireguard on port 54330")
    async with await AsyncConnection.connect(dsn) as connection:
        await connection.execute("DROP SCHEMA public CASCADE")
        await connection.execute("CREATE SCHEMA public")
    await PostgresRepository(dsn).init()
    print("demo database reset: fireguard")


if __name__ == "__main__":
    asyncio.run(main())
