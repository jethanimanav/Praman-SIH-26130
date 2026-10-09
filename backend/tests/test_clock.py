from datetime import datetime, timedelta
from app.core.clock import ClockService


class TestClockService:
    def setup_method(self):
        ClockService.reset()

    def teardown_method(self):
        ClockService.reset()

    def test_clock_real_time_by_default(self):
        before = datetime.utcnow()
        t = ClockService.now()
        after = datetime.utcnow()
        assert before <= t <= after

    def test_clock_is_not_simulated_by_default(self):
        assert not ClockService.is_simulated()

    def test_advance_clock(self):
        before = ClockService.now()
        ClockService.advance(days=5)
        after = ClockService.now()
        diff = after - before
        assert diff.days >= 4  # allow a tiny margin
        assert ClockService.is_simulated()

    def test_set_clock_to_specific_time(self):
        target = datetime(2026, 6, 15, 12, 0, 0)
        ClockService.set_time(target)
        assert ClockService.now() == target
        assert ClockService.is_simulated()

    def test_reset_clock(self):
        ClockService.advance(days=10)
        ClockService.reset()
        assert not ClockService.is_simulated()
        t = ClockService.now()
        real = datetime.utcnow()
        assert abs((t - real).total_seconds()) < 2
