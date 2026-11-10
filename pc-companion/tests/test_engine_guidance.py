"""Real engine timelines for voluntary morning/evening help and absolute choices."""
from copy import deepcopy
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest

from anker_companion.engine import CompanionEngine
from anker_companion.protocol import ProtocolError, plan_date, stamp, utc
from anker_companion.storage import AtomicStateStore
from tests.helpers import Clock, FakePlatform, TestVault, state


class GuidanceEngineTests(unittest.TestCase):
    def make(self, at='2026-11-12T07:00:00Z'):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        clock = Clock(at)
        vault = TestVault()
        store = AtomicStateStore(Path(directory.name) / 'state', vault)
        platform = FakePlatform()
        notes, audio = [], []
        surface = SimpleNamespace(render=lambda _view: None, show_note=lambda *note: notes.append(note))
        sound = SimpleNamespace(tick=lambda _at, enabled: audio.append(enabled), restore=lambda: None)
        engine = CompanionEngine(store, platform, clock, ui=surface, audio=sound)
        value = state(clock, state='DAY_ACTIVE', date=plan_date(clock()))
        value['prefs']['offlinePolicy'] = 'fixed-time'
        return SimpleNamespace(clock=clock, vault=vault, store=store, platform=platform, engine=engine,
                               value=value, notes=notes, audio=audio)

    def morning(self, home=False):
        f = self.make()
        now = f.clock()
        f.value['prefs']['morningCountdown'] = True
        f.value['schedule'].update(homeOffice=home, leaveAt=utc(now + 900), workStartAt=utc(now + 1200),
            wakeAt=utc(now - 1800), morningDeadlineAt=utc(now + 1800), bedAt=utc(now + 36000),
            windDownAt=utc(now + 34200), brainDumpAt=utc(now + 35400))
        f.engine.accept_state(f.value, 'pair', now)
        return f

    def evening(self, single=True):
        f = self.make('2026-11-12T20:00:00Z')
        f.value['prefs'].update(singleTransition=single, audioDuck=True)
        f.value['schedule'].update(pcStopAt=utc(f.clock() + 5400), bedAt=utc(f.clock() + 7200),
            windDownAt=utc(f.clock() + 900), brainDumpAt=utc(f.clock() + 6600))
        f.engine.local_settings({'enforceEnabled': True, 'audioDuck': True})
        f.engine.accept_state(f.value, 'pair', f.clock())
        return f

    def test_office_and_homeoffice_use_only_their_explicit_target(self):
        for home, title, kind, seconds in [(False, 'Losgehen', 'leave', 900), (True, 'Arbeitsbeginn', 'work', 1200)]:
            with self.subTest(home=home):
                f = self.morning(home)
                original = deepcopy(f.store.read()['snapshot'])
                view = f.engine.tick()
                self.assertEqual(view['morning'], {'title': title, 'kind': kind,
                    'targetAt': utc(f.clock() + seconds), 'remainingSeconds': seconds})
                self.assertIsNone(view['cardId'])
                self.assertEqual(f.store.read()['snapshot'], original)
                self.assertEqual(f.store.read()['outbox'], [])
                self.assertEqual(f.platform.effects, [])

    def test_missing_unknown_disabled_or_finished_morning_has_no_invented_countdown(self):
        for patch in ['disabled', 'unknown-home', 'missing-leave', 'before-wake', 'after-target']:
            with self.subTest(patch=patch):
                f = self.morning()
                if patch == 'disabled': f.value['prefs']['morningCountdown'] = False
                if patch == 'unknown-home': f.value['schedule'].pop('homeOffice')
                if patch == 'missing-leave': f.value['schedule']['leaveAt'] = None
                if patch == 'before-wake': f.value['schedule']['wakeAt'] = utc(f.clock() + 60)
                if patch == 'after-target': f.value['schedule']['leaveAt'] = utc(f.clock() - 1)
                f.engine.accept_state(f.value, 'pair', f.clock())
                self.assertIsNone(f.engine.tick()['morning'])
                self.assertEqual(f.platform.effects, [])

    def test_ten_minute_card_persists_across_ticks_but_is_once_across_restart_and_clock_rollback(self):
        f = self.morning()
        f.clock.now += 300
        first = f.engine.tick()
        self.assertEqual(first['cardKind'], 'morning')
        self.assertEqual(first['morning']['remainingSeconds'], 600)
        f.clock.now += 30
        self.assertEqual(f.engine.tick()['cardId'], first['cardId'])
        f.clock.now -= 20
        self.assertEqual(f.engine.tick()['cardId'], first['cardId'])
        restarted = CompanionEngine(f.store, f.platform, f.clock)
        view = restarted.tick()
        self.assertIsNotNone(view['morning'])
        self.assertIsNone(view['cardId'])
        self.assertEqual(f.store.read()['outbox'], [])

    def test_old_morning_deadline_is_not_replayed_after_target(self):
        f = self.morning()
        f.clock.now += 901
        self.assertIsNone(f.engine.tick()['morning'])
        self.assertIsNone(f.engine.tick()['cardId'])
        self.assertEqual(f.platform.effects, [])

    def test_morning_countdown_works_with_an_open_evening_without_inventing_a_bedtime(self):
        f = self.morning()
        f.value['schedule'].update(pcStopAt=None, bedAt=None, windDownAt=None, brainDumpAt=None)
        f.engine.accept_state(f.value, 'pair', f.clock())
        view = f.engine.tick()
        self.assertEqual(view['morning']['kind'], 'leave')
        self.assertIsNone(view['timePill'])
        self.assertEqual(f.engine.ack('rev1')['effective']['mode'], 'paused')

    def test_paused_or_expired_link_does_not_generate_morning_popup(self):
        for reason in ['pause', 'stale', 'expired']:
            with self.subTest(reason=reason):
                f = self.morning()
                if reason == 'pause': f.engine.pause()
                if reason == 'stale':
                    f.value['prefs']['offlinePolicy'] = 'pause'
                    f.engine.accept_state(f.value, 'pair', f.clock())
                    f.clock.now += 91
                if reason == 'expired': f.clock.now += 12 * 3600
                self.assertIsNone(f.engine.tick()['morning'])

    def test_real_night_latch_retains_priority_over_morning_help(self):
        f = self.morning()
        f.value.update(state='NIGHT_LOCK', lockEnforced=True)
        f.value['prefs']['strictLock'] = True
        f.value['schedule'].update(bedAt=utc(f.clock() - 1), windDownAt=utc(f.clock() - 1801))
        f.engine.local_settings({'enforceEnabled': True, 'strictLock': True})
        f.engine.accept_state(f.value, 'pair', f.clock())
        view = f.engine.tick()
        self.assertEqual(view['state'], 'MORNING_PENDING')
        self.assertIsNone(view['morning'])
        self.assertIsNone(view['cardId'])
        f.clock.now += 60
        f.engine.tick()
        self.assertEqual(f.platform.effects, ['lock'])
        self.assertEqual(f.store.read()['snapshot']['state'], 'NIGHT_LOCK')

    def test_single_transition_keeps_the_chosen_phone_time_and_only_final_stop(self):
        f = self.evening()
        f.clock.now += 899
        self.assertEqual(f.engine.tick()['state'], 'DAY_ACTIVE')
        f.clock.now += 1
        first = f.engine.tick()
        self.assertEqual((first['state'], first['cardKind']), ('EVENING_WIND_DOWN', 'transition'))
        f.clock.now += 3900  # Ten minutes before PC stop, but no T10 series.
        view = f.engine.tick()
        self.assertEqual((view['state'], view['cardId']), ('EVENING_WIND_DOWN', first['cardId']))
        self.assertNotIn(True, f.audio)
        f.clock.now += 600
        self.assertEqual(f.engine.tick()['graceRemaining'], 60)
        f.clock.now += 60
        f.engine.tick()
        self.assertEqual(f.platform.effects, ['lock'])

    def test_transition_is_not_replayed_by_extension_ack_revision_or_restart(self):
        f = self.evening()
        f.clock.now += 900
        first = f.engine.tick()
        f.engine.extend(30)
        self.assertEqual(f.engine.tick()['cardId'], first['cardId'])
        f.value.update(revision='confirmed-new', generatedAt=utc(f.clock()))
        f.engine.accept_state(f.value, 'pair', f.clock())
        self.assertEqual(f.engine.tick()['cardId'], first['cardId'])
        restarted = CompanionEngine(f.store, f.platform, f.clock)
        self.assertIsNone(restarted.tick()['cardId'])
        self.assertEqual(restarted.tick()['state'], 'EVENING_WIND_DOWN')

    def test_single_mode_dimming_does_not_start_a_hidden_thirty_minute_series(self):
        f = self.evening()
        f.value['prefs']['dimEnabled'] = True
        f.value['schedule']['windDownAt'] = utc(f.clock() + 4800)  # Only10min before stop.
        f.engine.local_settings({'dimEnabled': True})
        f.engine.accept_state(f.value, 'pair', f.clock())
        f.clock.now += 4200  # 20min before stop, chosen transition still10min away.
        self.assertEqual(f.engine.tick()['dimOpacity'], 0)
        f.clock.now += 600
        self.assertEqual(f.engine.tick()['dimOpacity'], 0)
        f.clock.now += 300
        self.assertAlmostEqual(f.engine.tick()['dimOpacity'], .125)

    def test_single_transition_has_no_late_catchup_and_does_not_invent_open_stop(self):
        f = self.evening()
        f.value['schedule'].update(pcStopAt=None, bedAt=None)
        f.engine.accept_state(f.value, 'pair', f.clock())
        f.clock.now += 1201
        view = f.engine.tick()
        self.assertEqual(view['state'], 'EVENING_WIND_DOWN')
        self.assertIsNone(view['cardId'])
        self.assertIsNone(view['graceRemaining'])
        self.assertEqual(f.platform.effects, [])

    def test_false_or_absent_single_mode_preserves_existing_three_phases(self):
        for optional in [False, None]:
            with self.subTest(optional=optional):
                f = self.evening(False)
                if optional is None: f.value['prefs'].pop('singleTransition')
                f.value['schedule']['windDownAt'] = utc(f.clock() + 5400)
                f.engine.accept_state(f.value, 'pair', f.clock())
                f.clock.now += 3600
                self.assertEqual(f.engine.tick()['state'], 'WIND_DOWN_T30')
                f.clock.now += 1200
                self.assertEqual(f.engine.tick()['state'], 'BRAIN_DUMP_T10')

    def test_shared_if_then_stays_only_on_evening_card_fields_not_notes_or_titles(self):
        f = self.evening()
        private = 'Wenn mein Abend beginnt, speichere ich meinen Entwurf.'
        f.value['prefs']['ifThen'] = private
        f.engine.accept_state(f.value, 'pair', f.clock())
        self.assertIsNone(f.engine.tick()['ifThen'])
        f.clock.now += 900
        view = f.engine.tick()
        self.assertEqual(view['ifThen'], private)
        self.assertNotIn(private, view['message'] + view['title'])
        self.assertFalse(any(private in repr(note) for note in f.notes))

    def test_time_pill_and_quiet_signal_begin_off_and_have_one_explicit_local_flag(self):
        f = self.evening()
        f.clock.now += 1800
        view = f.engine.tick()
        self.assertIsNone(view['timePill'])
        self.assertFalse(view['localPrefs']['quietSignalEnabled'])
        f.engine.local_settings({'timePillEnabled': True, 'quietSignalEnabled': True})
        view = f.engine.tick()
        self.assertEqual(view['timePill'], {'targetAt': utc(f.clock() + 3600), 'remainingSeconds': 3600})
        self.assertTrue(view['localPrefs']['quietSignalEnabled'])
        f.engine.local_settings({'timePillEnabled': False})
        self.assertIsNone(f.engine.tick()['timePill'])
        self.assertEqual(f.platform.effects, [])

    def test_desktop_metadata_is_copied_without_private_pairing_material(self):
        f = self.evening()
        f.store.update(lambda data: data.update(desktopPrefs={'pcName': 'My PC', 'theme': 'dark', 'hotkeys': {}}))
        view = f.engine.tick()
        self.assertEqual(view['desktopPrefs']['theme'], 'dark')
        view['desktopPrefs']['theme'] = 'light'
        self.assertEqual(f.store.read()['desktopPrefs']['theme'], 'dark')

    def test_local_notice_flags_are_strict_booleans_and_pill_does_not_interrupt_alarm(self):
        f = self.evening()
        for key in ['timePillEnabled', 'quietSignalEnabled']:
            for invalid in [1, 'true', None]:
                with self.subTest(key=key, invalid=invalid), self.assertRaises(ProtocolError):
                    f.engine.local_settings({key: invalid})
        f.engine.local_settings({'timePillEnabled': True})
        f.value['state'] = 'ALARM_RINGING'
        f.engine.accept_state(f.value, 'pair', f.clock())
        f.clock.now += 3600
        self.assertIsNone(f.engine.tick()['timePill'])

    def test_absolute_preview_uses_only_explicit_buffer_and_wake_without_mutation(self):
        f = self.evening()
        f.value['prefs']['bedAfterStopMin'] = 20
        f.value['schedule'].update(wakeAt='2026-11-13T05:00:00Z', morningDeadlineAt='2026-11-13T06:00:00Z')
        f.engine.accept_state(f.value, 'pair', f.clock())
        before = f.store.read()
        preview = f.engine.preview_extension_until('22:30')
        self.assertEqual(preview, {'pcStopAt': '2026-11-12T21:30:00.000Z', 'bedAt': '2026-11-12T21:50:00.000Z',
            'wakeAt': '2026-11-13T05:00:00.000Z', 'sleepOpportunityMinutes': 430})
        self.assertEqual(f.store.read(), before)
        f.engine.extend_until('22:30', expected_target_at=preview['pcStopAt'])
        self.assertEqual(f.store.read()['runtime']['extensionAt'], stamp(preview['pcStopAt']))
        self.assertEqual(f.store.read()['outbox'][-1]['newStopAt'], preview['pcStopAt'])

    def test_absolute_time_before_four_keeps_existing_plan_day_and_pause(self):
        f = self.make('2026-11-12T02:30:00Z')  # Berlin03:30, plan still November11.
        f.engine.accept_state(f.value, 'pair', f.clock())
        f.engine.pause()
        f.engine.extend_until('03:45')
        view = f.engine.tick()
        self.assertEqual(view['state'], 'IDLE')
        self.assertEqual(f.store.read()['outbox'][-1]['date'], '2026-11-11')
        self.assertEqual(f.store.read()['runtime']['suspendedDate'], '2026-11-11')
        self.assertEqual(f.platform.effects, [])

    def test_engine_absolute_choice_uses_second_autumn_fold_without_changing_plan_day(self):
        f = self.make('2026-10-25T00:40:00Z')  # 02:40 CEST;02:30 CET is still ahead.
        f.engine.accept_state(f.value, 'pair', f.clock())
        preview = f.engine.preview_extension_until('02:30')
        self.assertEqual(preview['pcStopAt'], '2026-10-25T01:30:00.000Z')
        f.engine.extend_until('02:30', expected_target_at=preview['pcStopAt'])
        event = f.store.read()['outbox'][-1]
        self.assertEqual((event['date'], event['newStopAt']), ('2026-10-24', preview['pcStopAt']))
        self.assertEqual(f.store.read()['snapshot']['state'], 'DAY_ACTIVE')
        self.assertEqual(f.platform.effects, [])

    def test_engine_rejects_nonexistent_spring_choice_before_any_persistence(self):
        f = self.make('2026-03-29T00:00:00Z')
        f.engine.accept_state(f.value, 'pair', f.clock())
        before = f.store.read()
        with self.assertRaisesRegex(ProtocolError, '^clock-nonexistent$'):
            f.engine.preview_extension_until('02:30')
        with self.assertRaisesRegex(ProtocolError, '^clock-nonexistent$'):
            f.engine.extend_until('02:30')
        self.assertEqual(f.store.read(), before)
        self.assertEqual(f.platform.effects, [])

    def test_bedtime_sequence_does_not_add_the_buffer_twice(self):
        f = self.evening()
        f.value['prefs'].update(bedtimeSequence=True, bedAfterStopMin=20)
        f.engine.accept_state(f.value, 'pair', f.clock())
        preview = f.engine.preview_extension_until('23:30')
        self.assertEqual(preview['pcStopAt'], preview['bedAt'])
        f.engine.extend_until('23:30')
        self.assertEqual(f.store.read()['outbox'][-1]['anchor'], 'bed')

    def test_missing_bounds_remain_unknown_and_expired_preview_is_not_applied_tomorrow(self):
        f = self.evening()
        f.value['schedule'].update(wakeAt=None, morningDeadlineAt=None)
        f.engine.accept_state(f.value, 'pair', f.clock())
        preview = f.engine.preview_extension_until('21:01')
        self.assertEqual(set(preview), {'pcStopAt'})
        before = f.store.read()
        f.clock.now += 61
        with self.assertRaisesRegex(ProtocolError, '^preview-expired$'):
            f.engine.extend_until('21:01', expected_target_at=preview['pcStopAt'])
        self.assertEqual(f.store.read(), before)

    def test_absolute_choice_cannot_bypass_strict_guard_or_expired_source(self):
        for strict in [False, True]:
            with self.subTest(strict=strict):
                f = self.evening()
                if strict:
                    f.value['prefs']['strictLock'] = True
                    f.engine.local_settings({'strictLock': True})
                    f.engine.accept_state(f.value, 'pair', f.clock())
                else: f.clock.now += 12 * 3600
                before = f.store.read()
                with self.assertRaises(ProtocolError): f.engine.preview_extension_until('23:30')
                with self.assertRaises(ProtocolError): f.engine.extend_until('23:30')
                self.assertEqual(f.store.read(), before)
                self.assertEqual(f.platform.effects, [])

    def test_failed_absolute_persistence_rolls_back_target_and_event_together(self):
        f = self.evening()
        before = f.store.read()
        f.vault.fail = True
        with self.assertRaises(OSError): f.engine.extend_until('23:30')
        self.assertEqual(f.store.read(), before)


if __name__ == '__main__':
    unittest.main(verbosity=2)
