import asyncio
import unittest

from fireguard_backend.streaming import EventBroker


class EventBrokerTests(unittest.IsolatedAsyncioTestCase):
    async def test_published_event_reaches_subscriber(self):
        broker = EventBroker()
        subscription = broker.subscribe()
        waiting = asyncio.create_task(subscription.__anext__())
        await asyncio.sleep(0)

        await broker.publish({"id": 7, "event_type": "fire_alarm"})

        self.assertEqual(await asyncio.wait_for(waiting, timeout=1), {"id": 7, "event_type": "fire_alarm"})
        await subscription.aclose()


if __name__ == "__main__":
    unittest.main()
