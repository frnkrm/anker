package de.frnkrm.anker
import org.junit.Assert.*
import org.junit.Test

class WidgetModelTest {
    @Test fun expiresAndLegacyStandAreHonest() { assertTrue(WidgetModel.isFresh(1000, 3000, 2000)); assertFalse(WidgetModel.isFresh(1000, 2000, 2000)); assertFalse(WidgetModel.isFresh(0, 3000, 2000)); assertFalse(WidgetModel.isFresh(100_000, 120_000, 1000)) }
    @Test fun refreshAlsoAtExpiryWithoutNextEntry() { assertEquals(3000L, WidgetModel.nextRefresh(null, 3000, 2000)); assertEquals(2500L, WidgetModel.nextRefresh(2500, 3000, 2000)); assertNull(WidgetModel.nextRefresh(null, 2000, 3000)) }
}
