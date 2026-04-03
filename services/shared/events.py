"""
events.py — Cross-Service Event Bus
====================================
Async event bus for cross-service communication using Redis Pub/Sub.
Enables loose coupling between services while maintaining data consistency.
"""

from __future__ import annotations

import asyncio
import json
import logging
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional, Type, TypeVar

# Optional Redis import
try:
    import redis.asyncio as aioredis
    _REDIS_AVAILABLE = True
except ImportError:
    aioredis = None
    _REDIS_AVAILABLE = False

logger = logging.getLogger("manthana.events")

T = TypeVar("T", bound="DomainEvent")


# ═══════════════════════════════════════════════════════════════════════
#  DOMAIN EVENTS
# ═══════════════════════════════════════════════════════════════════════

@dataclass
class DomainEvent:
    """Base class for all domain events."""

    event_id: str = field(default_factory=lambda: __import__("uuid").uuid4().hex)
    event_type: str = field(default="")
    timestamp: datetime = field(default_factory=datetime.utcnow)
    service_origin: str = field(default="unknown")
    user_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert event to dictionary."""
        data = asdict(self)
        data["timestamp"] = self.timestamp.isoformat()
        return data

    def to_json(self) -> str:
        """Convert event to JSON string."""
        return json.dumps(self.to_dict(), default=str)

    @classmethod
    def from_dict(cls: Type[T], data: Dict[str, Any]) -> T:
        """Create event from dictionary."""
        # Parse timestamp back to datetime
        if "timestamp" in data and isinstance(data["timestamp"], str):
            data["timestamp"] = datetime.fromisoformat(data["timestamp"])
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


@dataclass
class UserSearchEvent(DomainEvent):
    """Emitted when user performs a search."""

    event_type: str = "user_search"
    query: str = ""
    domain: str = "allopathy"
    category: str = "medical"
    results_count: int = 0
    session_id: Optional[str] = None


@dataclass
class ChatMessageEvent(DomainEvent):
    """Emitted when user sends chat message."""

    event_type: str = "chat_message"
    message: str = ""
    domain: str = "allopathy"
    mode: str = "auto"
    response_length: int = 0
    session_id: Optional[str] = None


@dataclass
class AnalysisCompletedEvent(DomainEvent):
    """Emitted when image analysis completes."""

    event_type: str = "analysis_completed"
    analysis_id: str = ""
    modality: str = ""
    findings_count: int = 0
    service_used: str = ""
    confidence_avg: float = 0.0


@dataclass
class ResearchSessionEvent(DomainEvent):
    """Emitted when research session is created/updated."""

    event_type: str = "research_session"
    session_id: str = ""
    query: str = ""
    domains: List[str] = field(default_factory=list)
    sources_count: int = 0
    citations_count: int = 0


@dataclass
class PlagiarismCheckEvent(DomainEvent):
    """Emitted when plagiarism check completes."""

    event_type: str = "plagiarism_check"
    scan_id: str = ""
    originality_score: float = 0.0
    matched_percent: float = 0.0
    sentences_analysed: int = 0


# Event registry for deserialization
EVENT_REGISTRY: Dict[str, Type[DomainEvent]] = {
    "user_search": UserSearchEvent,
    "chat_message": ChatMessageEvent,
    "analysis_completed": AnalysisCompletedEvent,
    "research_session": ResearchSessionEvent,
    "plagiarism_check": PlagiarismCheckEvent,
}


def register_event(event_type: str, event_class: Type[DomainEvent]) -> None:
    """Register an event type for deserialization."""
    EVENT_REGISTRY[event_type] = event_class


# ═══════════════════════════════════════════════════════════════════════
#  EVENT BUS
# ═══════════════════════════════════════════════════════════════════════

class EventBus:
    """Async event bus using Redis Pub/Sub."""

    def __init__(
        self,
        redis_url: str = "redis://redis:6379",
        service_name: str = "unknown",
    ):
        self.redis_url = redis_url
        self.service_name = service_name
        self._redis: Optional[Any] = None
        self._subscribers: Dict[str, List[Callable]] = {}
        self._running = False
        self._listener_task: Optional[asyncio.Task] = None

    async def connect(self) -> bool:
        """Connect to Redis."""
        if not _REDIS_AVAILABLE:
            logger.warning("Redis not available, events will be logged only")
            return False

        try:
            self._redis = await aioredis.from_url(
                self.redis_url,
                decode_responses=True,
            )
            await self._redis.ping()
            logger.info(f"Event bus connected to Redis: {self.redis_url}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect event bus to Redis: {e}")
            self._redis = None
            return False

    async def disconnect(self) -> None:
        """Disconnect from Redis."""
        self._running = False
        if self._listener_task:
            self._listener_task.cancel()
            try:
                await self._listener_task
            except asyncio.CancelledError:
                pass
        if self._redis:
            await self._redis.close()
            logger.info("Event bus disconnected from Redis")

    async def publish(self, event: DomainEvent) -> bool:
        """Publish an event to the bus."""
        event.service_origin = self.service_name

        if self._redis:
            try:
                channel = f"events:{event.event_type}"
                await self._redis.publish(channel, event.to_json())
                # Also publish to "all" channel for catch-all subscribers
                await self._redis.publish("events:all", event.to_json())
                return True
            except Exception as e:
                logger.error(f"Failed to publish event: {e}")

        # Fallback: log event
        logger.info(f"Event (logged): {event.event_type} - {event.to_json()[:200]}")
        return False

    def subscribe(self, event_type: str, handler: Callable[[DomainEvent], Any]) -> None:
        """Subscribe to events of a specific type."""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        logger.info(f"Subscribed to events: {event_type}")

    def unsubscribe(self, event_type: str, handler: Callable[[DomainEvent], Any]) -> None:
        """Unsubscribe from events."""
        if event_type in self._subscribers:
            self._subscribers[event_type] = [
                h for h in self._subscribers[event_type] if h != handler
            ]

    async def start_listener(self) -> None:
        """Start listening for events (run as background task)."""
        if not self._redis or self._running:
            return

        self._running = True
        self._listener_task = asyncio.create_task(self._listen_loop())

    async def _listen_loop(self) -> None:
        """Main listening loop."""
        if not self._redis:
            return

        # Subscribe to channels
        pubsub = self._redis.pubsub()
        channels = [f"events:{et}" for et in self._subscribers.keys()]
        channels.append("events:all")

        await pubsub.subscribe(*channels)
        logger.info(f"Event listener started on channels: {channels}")

        try:
            async for message in pubsub.listen():
                if not self._running:
                    break
                if message["type"] == "message":
                    await self._handle_message(message)
        except asyncio.CancelledError:
            logger.info("Event listener cancelled")
        except Exception as e:
            logger.error(f"Event listener error: {e}")
        finally:
            await pubsub.unsubscribe(*channels)
            await pubsub.close()

    async def _handle_message(self, message: Dict[str, Any]) -> None:
        """Handle incoming message."""
        try:
            data = json.loads(message["data"])
            event_type = data.get("event_type", "unknown")

            # Deserialize event
            event_class = EVENT_REGISTRY.get(event_type, DomainEvent)
            event = event_class.from_dict(data)

            # Call subscribers
            handlers = self._subscribers.get(event_type, []) + self._subscribers.get("all", [])
            for handler in handlers:
                try:
                    if asyncio.iscoroutinefunction(handler):
                        await handler(event)
                    else:
                        handler(event)
                except Exception as e:
                    logger.error(f"Event handler error: {e}")

        except json.JSONDecodeError as e:
            logger.error(f"Failed to decode event: {e}")
        except Exception as e:
            logger.error(f"Failed to handle event: {e}")


# ═══════════════════════════════════════════════════════════════════════
#  SERVICE-SPECIFIC EVENT HELPERS
# ═══════════════════════════════════════════════════════════════════════

class ServiceEventBus:
    """Convenience wrapper for service-specific event publishing."""

    def __init__(self, service_name: str, redis_url: str = "redis://redis:6379"):
        self.service_name = service_name
        self.bus = EventBus(redis_url, service_name)

    async def connect(self) -> bool:
        """Connect to Redis."""
        return await self.bus.connect()

    async def disconnect(self) -> None:
        """Disconnect from Redis."""
        await self.bus.disconnect()

    async def publish_search(self, query: str, domain: str, results_count: int, user_id: Optional[str] = None) -> bool:
        """Publish user search event."""
        event = UserSearchEvent(
            query=query,
            domain=domain,
            results_count=results_count,
            user_id=user_id,
        )
        return await self.bus.publish(event)

    async def publish_chat(self, message: str, domain: str, response_length: int, user_id: Optional[str] = None) -> bool:
        """Publish chat message event."""
        event = ChatMessageEvent(
            message=message,
            domain=domain,
            response_length=response_length,
            user_id=user_id,
        )
        return await self.bus.publish(event)

    async def publish_analysis(self, analysis_id: str, modality: str, findings_count: int, service_used: str, confidence_avg: float, user_id: Optional[str] = None) -> bool:
        """Publish analysis completed event."""
        event = AnalysisCompletedEvent(
            analysis_id=analysis_id,
            modality=modality,
            findings_count=findings_count,
            service_used=service_used,
            confidence_avg=confidence_avg,
            user_id=user_id,
        )
        return await self.bus.publish(event)

    async def publish_research(self, session_id: str, query: str, domains: List[str], sources_count: int, citations_count: int, user_id: Optional[str] = None) -> bool:
        """Publish research session event."""
        event = ResearchSessionEvent(
            session_id=session_id,
            query=query,
            domains=domains,
            sources_count=sources_count,
            citations_count=citations_count,
            user_id=user_id,
        )
        return await self.bus.publish(event)

    async def publish_plagiarism(self, scan_id: str, originality_score: float, matched_percent: float, sentences_analysed: int, user_id: Optional[str] = None) -> bool:
        """Publish plagiarism check event."""
        event = PlagiarismCheckEvent(
            scan_id=scan_id,
            originality_score=originality_score,
            matched_percent=matched_percent,
            sentences_analysed=sentences_analysed,
            user_id=user_id,
        )
        return await self.bus.publish(event)
