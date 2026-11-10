package de.frnkrm.anker

import java.time.LocalDate
import org.junit.Assert.*
import org.junit.Test

class ReminderQuietBedTest {
    private val date = "2026-11-12"
    private val now = AlarmPlanner.toUtc(LocalDate.parse(date), 23 * 60)
    private val source = ReminderEntry("bed", date, now, "sanft", "Allgemeiner Hinweis", "", false, 1, 4, false,
        revision = "quiet-revision", token = "quiet-delivery", critical = true, quietFollowUps = true)

    @Test fun nurExpliziterBettquelleneintragBekommtZweiStundenStattNormalemRueckstau() {
        assertEquals(ReminderLogic.QUIET_BED_FRESH_MS, ReminderLogic.freshness(source))
        assertEquals(ReminderLogic.STALE_MS, ReminderLogic.freshness(source.copy(quietFollowUps = false)))
        assertEquals(ReminderLogic.STALE_MS, ReminderLogic.freshness(source.copy(key = "morning")))
        assertEquals(listOf(source), ReminderLogic.takeDue(listOf(source), now + ReminderLogic.QUIET_BED_FRESH_MS).due)
        assertTrue(ReminderLogic.takeDue(listOf(source), now + ReminderLogic.QUIET_BED_FRESH_MS + 1).due.isEmpty())
        assertTrue(ReminderLogic.takeDue(listOf(source.copy(quietFollowUps = false)), now + ReminderLogic.STALE_MS + 1).due.isEmpty())
    }

    @Test fun appAbgleichErhaeltNurAktuelleRelevanteStilleBettquelle() {
        val revisions = mapOf("$date|bed" to source.revision)
        assertEquals(listOf(source), ReminderLogic.replace(listOf(source), emptyList(), revisions.keys, now + 90 * 60_000L, revisions))
        assertTrue(ReminderLogic.replace(listOf(source), emptyList(), revisions.keys, now + ReminderLogic.QUIET_BED_FRESH_MS + 1, revisions).isEmpty())
        assertTrue(ReminderLogic.replace(listOf(source), emptyList(), emptySet(), now + 1, emptyMap()).isEmpty())
        assertTrue(ReminderLogic.replace(listOf(source), emptyList(), revisions.keys, now + 1, mapOf("$date|bed" to "changed")).isEmpty())
    }

    @Test fun stilleQuelleNutztNieDieExakteOderUngenaueWakeupSchiene() {
        val exact = source.copy(key = "leave", exact = true, quietFollowUps = false, at = now + 200)
        val soft = source.copy(key = "evening", quietFollowUps = false, at = now + 100)
        val targets = ReminderLogic.nextTicks(listOf(exact, source.copy(exact = true), soft))
        assertEquals(exact, targets.exact)
        assertEquals(soft, targets.inexact)
        assertEquals(source.copy(exact = true), targets.quiet)
        assertNull(ReminderLogic.nextTicks(listOf(source)).exact)
        assertNull(ReminderLogic.nextTicks(listOf(source)).inexact)
    }

    @Test fun alteAbgewaehlteOderFehlerhafteQuelleFaelltNiemalsAufNormalesBettGeraeuschZurueck() {
        val enabled = ReminderPolicy(bedtimeFollowUpsEnabled = true)
        val current = mapOf("$date|bed" to source.revision)
        assertTrue(ReminderLogic.canStartQuietBed(source, enabled, current))
        assertFalse(ReminderLogic.canStartQuietBed(source, ReminderPolicy(), current))
        assertFalse(ReminderLogic.canStartQuietBed(source, enabled, emptyMap()))
        assertFalse(ReminderLogic.canStartQuietBed(source, enabled, mapOf("$date|bed" to "changed")))
        assertFalse(ReminderLogic.canStartQuietBed(source.copy(key = "morning"), enabled, current))
        assertTrue(ReminderLogic.quietPath(source, ReminderPolicy()))
        assertTrue(ReminderLogic.quietPath(source.copy(key = "morning"), enabled))
        assertTrue(ReminderLogic.quietPath(source.copy(quietFollowUps = false), enabled))
        assertFalse(ReminderLogic.quietPath(source.copy(quietFollowUps = false), ReminderPolicy()))
    }

    @Test fun wochenquelleBleibtImAktivenFensterGueltigUndEntfernteRegelBeendetSie() {
        // Actual canonical TS buildReminderRuleSnapshot(defaultSettings, opt-in,
        // fallAsleepMin=20), rather than an unrealistically short revision.
        val revision = """[{"ruleId":"basis:0:bed","key":"bed","weekday":0,"minute":1315,"channel":"sanft","title":"Deine gewählte Schlafenszeit","body":"Anker kann dich nach deiner Einschlafdauer still an deinen Plan erinnern. Du entscheidest, wie es weitergeht.","slot":1,"rank":4,"exact":false,"quietFollowUps":true},{"delayMinutes":20}]"""
        val rule = NativeReminderRule("basis:0:bed", "bed", 0, 1315, "sanft", "Deine gewählte Schlafenszeit",
            "Anker kann dich nach deiner Einschlafdauer still an deinen Plan erinnern. Du entscheidest, wie es weitergeht.", 1, 4, false, revision, quietFollowUps = true)
        val sourceDate = "2026-11-09"
        val bed = AlarmPlanner.toUtc(LocalDate.parse(sourceDate), rule.minute)
        val snapshot = NativeReminderRuleSnapshot(bed - 86400_000L, emptySet(), listOf(rule))
        assertEquals(314, revision.length)
        assertEquals(325, "$revision|$sourceDate".length)
        assertEquals(mapOf("$sourceDate|bed" to "$revision|$sourceDate"), ReminderRules.quietBedRevisions(snapshot, bed + 90 * 60_000L, 20))
        assertTrue("$sourceDate|bed" in ReminderRules.quietBedRevisions(snapshot, bed + ReminderLogic.QUIET_BED_FRESH_MS + 20 * 60_000L, 20))
        assertFalse("$sourceDate|bed" in ReminderRules.quietBedRevisions(snapshot, bed + ReminderLogic.QUIET_BED_FRESH_MS + 20 * 60_000L + 1, 20))
        assertFalse("$sourceDate|bed" in ReminderRules.quietBedRevisions(snapshot, bed + ReminderLogic.QUIET_BED_FRESH_MS + 1))
        assertTrue(ReminderRules.quietBedRevisions(snapshot.copy(rules = emptyList()), bed + 1).isEmpty())
        assertFalse("$sourceDate|bed" in ReminderRules.quietBedRevisions(snapshot.copy(excludedDates = setOf(sourceDate)), bed + 1))
    }

    @Test fun nurStilleBettregelKannDasFlagFortsetzen() {
        val rule = NativeReminderRule("basis:3:bed", "bed", 3, 23 * 60, "sanft", "Allgemein", "", 1, 4, false,
            "weekly-quiet", quietFollowUps = true)
        for (bad in listOf(rule.copy(channel = "wecker"), rule.copy(exact = true), rule.copy(key = "leave", ruleId = "basis:3:leave"))) {
            val snapshot = NativeReminderRuleSnapshot(now - 86400_000L, emptySet(), listOf(bad))
            assertNull(ReminderRules.nextOccurrence(bad, snapshot, now - 1))
            assertTrue(ReminderRules.quietBedRevisions(snapshot, now).isEmpty())
        }
    }

    @Test fun quelltokenWirdErstNachSichererAsynchronerUebergabeVerbraucht() {
        val retry = ReminderLogic.retryQuietSource(source, now)!!
        val failed = ReminderLogic.completeQuietSource(listOf(retry), emptyMap(), source, false, retry.at)
        assertFalse(source.token in failed.second)
        assertEquals(source.token, failed.first.single().token)
        assertEquals(source.at, PcReminderGate.originalAt(failed.first.single()))
        val complete = ReminderLogic.completeQuietSource(failed.first, failed.second, source, true, failed.first.single().at)
        assertTrue(complete.first.isEmpty())
        assertTrue(source.token in complete.second)
    }

    @Test fun spaeterCallbackErwecktKeineZwischenzeitlichEntfernteOderNeueQuelle() {
        val changed = source.copy(revision = "new-revision", token = "new-delivery")
        assertTrue(ReminderLogic.completeQuietSource(emptyList(), emptyMap(), source, false, now).first.isEmpty())
        assertEquals(listOf(changed), ReminderLogic.completeQuietSource(listOf(changed), emptyMap(), source, false, now).first)
        val complete = ReminderLogic.completeQuietSource(listOf(changed), emptyMap(), source, true, now)
        assertEquals(listOf(changed), complete.first)
        assertFalse(changed.token in complete.second)
    }

    @Test fun stilleKarteTeiltDasDreierbudgetUndVerdraengtNiemalsDenWecker() {
        assertTrue(ReminderLogic.quietDisplayFits(2, 0, false, false))
        assertFalse(ReminderLogic.quietDisplayFits(3, 0, false, false))
        assertTrue(ReminderLogic.quietDisplayFits(1, 1, false, false))
        assertFalse(ReminderLogic.quietDisplayFits(1, 2, false, false))
        assertTrue(ReminderLogic.quietDisplayFits(2, 1, true, false))
        assertFalse(ReminderLogic.quietDisplayFits(2, 2, true, false))
        assertFalse(ReminderLogic.quietDisplayFits(0, 0, false, true))
        assertFalse(ReminderLogic.quietDisplayFits(0, 1, true, true))
        assertFalse(ReminderLogic.quietDisplayFits(0, -1, false, false))
    }
}
