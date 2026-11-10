"""Wall-clock/DST boundaries and backward-compatible optional wire preferences."""
from copy import deepcopy
from datetime import datetime
import unittest

from anker_companion.protocol import ProtocolError, next_local_time, prefs, utc, validate_briefing, validate_state
from tests.helpers import Clock, state


def at(value):
    return datetime.fromisoformat(value.replace('Z', '+00:00')).timestamp()


class WallTimeTests(unittest.TestCase):
    def test_normal_wall_time_uses_berlin_and_next_future_date(self):
        self.assertEqual(utc(next_local_time('23:00', at('2026-11-12T20:00:00Z'))), '2026-11-12T22:00:00.000Z')
        self.assertEqual(utc(next_local_time('23:00', at('2026-11-12T22:00:00Z'))), '2026-11-13T22:00:00.000Z')

    def test_before_and_after_four_are_real_clock_times_not_a_second_day_planner(self):
        self.assertEqual(utc(next_local_time('03:45', at('2026-11-12T02:30:00Z'))), '2026-11-12T02:45:00.000Z')
        self.assertEqual(utc(next_local_time('04:15', at('2026-11-12T03:00:00Z'))), '2026-11-12T03:15:00.000Z')

    def test_spring_gap_is_rejected_instead_of_silently_moving_to_three_thirty(self):
        for now in ['2026-03-29T00:00:00Z', '2026-03-28T03:00:00Z']:
            with self.subTest(now=now), self.assertRaisesRegex(ProtocolError, '^clock-nonexistent$'):
                next_local_time('02:30', at(now))

    def test_already_passed_gap_today_can_choose_the_real_next_day(self):
        self.assertEqual(utc(next_local_time('02:30', at('2026-03-29T02:00:00Z'))), '2026-03-30T00:30:00.000Z')

    def test_autumn_ambiguity_chooses_earliest_remaining_fold(self):
        for now, expected in [('2026-10-25T00:00:00Z', '2026-10-25T00:30:00.000Z'),
                              ('2026-10-25T00:40:00Z', '2026-10-25T01:30:00.000Z'),
                              ('2026-10-25T01:30:00Z', '2026-10-26T01:30:00.000Z')]:
            with self.subTest(now=now):
                self.assertEqual(utc(next_local_time('02:30', at(now))), expected)

    def test_a_twenty_five_hour_autumn_next_occurrence_is_outside_the_limit(self):
        with self.assertRaisesRegex(ProtocolError, '^clock-range$'):
            next_local_time('03:00', at('2026-10-24T01:00:00Z'))

    def test_spring_day_can_reach_tomorrow_in_twenty_three_real_hours(self):
        self.assertEqual(utc(next_local_time('03:00', at('2026-03-28T02:00:00Z'))), '2026-03-29T01:00:00.000Z')

    def test_only_ascii_hhmm_is_accepted(self):
        for value in ['9:00', '24:00', '23:60', ' 21:00', '21:00\n', '21.00', '0١:3٠', '２１:００', '', None, 2100, True]:
            with self.subTest(value=value), self.assertRaisesRegex(ProtocolError, '^clock$'):
                next_local_time(value, at('2026-11-12T20:00:00Z'))

    def test_invalid_or_unrepresentable_current_clock_has_a_redacted_code(self):
        for now in [float('nan'), float('inf'), -float('inf'), 1e100, -1e100, True, None, 'now']:
            with self.subTest(now=now), self.assertRaisesRegex(ProtocolError, '^clock-range$'):
                next_local_time('21:00', now)


class OptionalPreferenceTests(unittest.TestCase):
    def setUp(self):
        self.value = state(Clock())

    def briefing(self, preferences):
        return {'type': 'briefing', 'revision': 'optional-prefs', 'generatedAt': self.value['generatedAt'],
                'validUntil': self.value['validUntil'], 'prefs': preferences,
                'days': [{'date': self.value['date'], 'validUntil': self.value['validUntil'], 'pc': {'mode': 'paused'}}]}

    def test_legacy_absence_and_both_explicit_boolean_values_work_in_state_and_briefing(self):
        for enabled in [None, False, True]:
            with self.subTest(enabled=enabled):
                value = deepcopy(self.value)
                if enabled is not None: value['prefs']['singleTransition'] = enabled
                self.assertIs(validate_state(value), value)
                validate_briefing(self.briefing(value['prefs']))

    def test_buffer_is_an_optional_bounded_integer_and_never_a_boolean(self):
        for minutes in [None, 0, 1, 20, 30]:
            with self.subTest(minutes=minutes):
                value = deepcopy(self.value)
                if minutes is not None: value['prefs']['bedAfterStopMin'] = minutes
                validate_state(value)
                validate_briefing(self.briefing(value['prefs']))
        for minutes in [-1, 31, 1.0, True, False, '20', None]:
            with self.subTest(invalid=minutes):
                value = deepcopy(self.value)
                value['prefs']['bedAfterStopMin'] = minutes
                with self.assertRaises(ProtocolError): validate_state(value)
                with self.assertRaises(ProtocolError): validate_briefing(self.briefing(value['prefs']))

    def test_invalid_single_mode_or_unknown_keys_remain_rejected(self):
        for value in [None, 1, 0, 'true', {}, []]:
            with self.subTest(value=value):
                preferences = {**self.value['prefs'], 'singleTransition': value}
                with self.assertRaises(ProtocolError): prefs(preferences)
        with self.assertRaises(ProtocolError): prefs({**self.value['prefs'], 'pretendFeature': True})


if __name__ == '__main__':
    unittest.main(verbosity=2)
