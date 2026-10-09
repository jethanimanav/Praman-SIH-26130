"""
Clock service.

Wraps datetime.utcnow() so that:
- Normal operation: returns real time.
- Demo/SLA simulation: can be overridden to advance time artificially.

Never import datetime.utcnow() directly in business logic.
Always use ClockService.now().
"""
from datetime import datetime, timedelta
from typing import Optional


class ClockService:
    """Singleton clock service for the application."""

    _override: Optional[datetime] = None
    _offset: timedelta = timedelta(0)

    @classmethod
    def now(cls) -> datetime:
        """Return the current (possibly simulated) UTC time."""
        if cls._override is not None:
            return cls._override + cls._offset
        return datetime.utcnow() + cls._offset

    @classmethod
    def advance(cls, days: int = 0, hours: int = 0, minutes: int = 0) -> datetime:
        """Advance the simulated clock forward. Returns the new time."""
        cls._offset += timedelta(days=days, hours=hours, minutes=minutes)
        return cls.now()

    @classmethod
    def set_time(cls, dt: datetime) -> None:
        """Pin the clock to a specific datetime (for demo scenarios)."""
        cls._override = dt
        cls._offset = timedelta(0)

    @classmethod
    def reset(cls) -> None:
        """Reset to real time."""
        cls._override = None
        cls._offset = timedelta(0)

    @classmethod
    def is_simulated(cls) -> bool:
        """Return True if the clock is in a simulated state."""
        return cls._override is not None or cls._offset.total_seconds() != 0


# Module-level convenience
def now() -> datetime:
    return ClockService.now()
