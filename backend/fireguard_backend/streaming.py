import asyncio


class EventBroker:
    """Process-local SSE fan-out; switch to PostgreSQL LISTEN/NOTIFY for multi-worker deploys."""

    def __init__(self):
        self._subscribers = set()

    async def publish(self, event):
        for queue in tuple(self._subscribers):
            if queue.full():
                queue.get_nowait()
            queue.put_nowait(event)

    async def subscribe(self):
        queue = asyncio.Queue(maxsize=32)
        self._subscribers.add(queue)
        try:
            while True:
                try:
                    yield await asyncio.wait_for(queue.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield None
        finally:
            self._subscribers.discard(queue)
