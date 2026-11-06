package de.frnkrm.anker

import org.junit.Assert.*
import org.junit.Test

class PrintModelTest {
    private val measure: (String, Float, Boolean) -> Float = { value, size, _ -> value.length * size * 0.52f }

    @Test fun longRoutinesPaginateForBothPaperSizesAndLargeFontWithoutDroppingSteps() {
        val items = (1..120).map { "Schritt $it: Äpfel und Öl bereitstellen, dann Grüße nach draußen." }
        val sheet = PrintSheetData("Morgenroutine", "Ab 06:30", items, "Die kleine Version zählt auch.")
        for (paper in PrintPaper.entries) for (scale in listOf(1f, 1.6f)) {
            val pages = PrintPaginator.layout(listOf(sheet), paper, scale, measure)
            assertTrue(pages.size > 1)
            assertEquals(items.size, pages.sumOf { p -> p.commands.count { it is PrintDraw.Box } })
            val text = pages.flatMap { it.commands }.filterIsInstance<PrintDraw.Text>().joinToString(" ") { it.value }
            for (item in items) assertTrue("Missing $item", text.replace(" ", "").contains(item.replace(" ", "")))
            for (page in pages) for (command in page.commands) when (command) {
                is PrintDraw.Text -> {
                    assertTrue(command.x >= PrintPaginator.MARGIN)
                    assertTrue(command.x + measure(command.value, command.size, command.bold) <= paper.width - PrintPaginator.MARGIN + 0.1f)
                    assertTrue(command.top >= PrintPaginator.MARGIN)
                    assertTrue(command.top + command.size * 1.4f <= paper.height - PrintPaginator.MARGIN + 0.1f)
                }
                is PrintDraw.Box -> assertTrue(command.top + command.size <= paper.height - PrintPaginator.MARGIN)
                is PrintDraw.Qr -> fail("Unexpected QR")
            }
        }
    }

    @Test fun evenOneOversizedStepMayContinueOnSeveralPagesWithOneCheckbox() {
        val item = "EinLangerTextOhneLeerzeichenÄÖÜß🧠".repeat(60)
        val pages = PrintPaginator.layout(listOf(PrintSheetData("Abendroutine", null, listOf(item), null)), PrintPaper.A5, 2f, measure)
        assertTrue(pages.size > 2)
        assertEquals(1, pages.sumOf { p -> p.commands.count { it is PrintDraw.Box } })
        val lines = pages.flatMap { it.commands }.filterIsInstance<PrintDraw.Text>().drop(1)
        assertEquals(item, lines.joinToString("") { it.value })
        for (line in lines) {
            assertFalse(line.value.firstOrNull()?.isLowSurrogate() == true)
            assertFalse(line.value.lastOrNull()?.isHighSurrogate() == true)
        }
    }

    @Test fun eachSelectedRoutineStartsOnANewPageWithoutBlankTrailingPages() {
        val sheets = listOf(PrintSheetData("Morgenroutine", null, listOf("Ein Schritt"), null), PrintSheetData("Abendroutine", null, listOf("Ein Schritt"), null))
        val pages = PrintPaginator.layout(sheets, PrintPaper.A5, 1f, measure)
        assertEquals(2, pages.size)
        assertEquals("Morgenroutine", (pages[0].commands.first() as PrintDraw.Text).value)
        assertEquals("Abendroutine", (pages[1].commands.first() as PrintDraw.Text).value)
        assertTrue(PrintPaginator.layout(emptyList(), PrintPaper.A5, 1f, measure).isEmpty())
    }

    @Test fun wrappingPreservesNewlinesAndUnicodeInsteadOfTruncating() {
        val value = "Äpfel, Öl und Grüße\n🧠Straße ohne Ende\n"
        val lines = PrintPaginator.wrap(value, 50f) { it.length * 8f }
        assertEquals(value.filterNot { it.isWhitespace() }, lines.joinToString("").filterNot { it.isWhitespace() })
        assertEquals("", lines.last())
    }

    @Test fun dedicatedHtmlEscapesUserTextAndLoadsNoAppUiOrExternalAssets() {
        val sheet = PrintSheetData("Morgenroutine", null, listOf("<script>alert('a')</script>", "<img src=\"https://invalid.example/x\"> & Öl"), null)
        val html = PrintHtml.document(listOf(sheet), PrintPaper.A4, 1.6f)
        assertTrue(html.contains("@page{size:A4"))
        assertTrue(html.contains("font-size:27.2pt"))
        assertTrue(html.contains("&lt;script&gt;"))
        assertTrue(html.contains("&amp; Öl"))
        assertFalse(html.contains("<script"))
        assertFalse(html.contains("<img"))
        assertFalse(html.contains("<nav"))
        assertFalse(html.contains("<button"))
    }

    @Test fun nativeQrKeepsFourWhiteModulesOnEverySideAndFitsOnA5() {
        val bits = MutableList(21 * 21) { 0 }.apply { this[0] = 1; this[lastIndex] = 1 }
        val qr = PrintQr(21, bits)
        val sheet = PrintSheetData("Guten Morgen", "Scannen beendet den Anker-Wecker.", emptyList(), "Hängt am besten im Bad.", qr)
        val command = PrintPaginator.layout(listOf(sheet), PrintPaper.A5, 1.6f, measure).flatMap { it.commands }.filterIsInstance<PrintDraw.Qr>().single()
        assertEquals(qr, command.matrix)
        assertTrue(command.x >= PrintPaginator.MARGIN)
        assertTrue(command.x + command.edge <= PrintPaper.A5.width - PrintPaginator.MARGIN)
        val html = PrintHtml.document(listOf(sheet), PrintPaper.A5, 1f)
        assertTrue(html.contains("viewBox=\"0 0 29 29\""))
        assertTrue(html.contains("x=\"4\" y=\"4\""))
        assertTrue(html.contains("x=\"24\" y=\"24\""))
    }
}
