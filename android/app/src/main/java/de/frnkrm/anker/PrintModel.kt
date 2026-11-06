package de.frnkrm.anker

import java.text.BreakIterator
import java.util.Locale

enum class PrintPaper(val width: Int, val height: Int) {
    A5(420, 595), A4(595, 842);
    companion object { fun of(value: String?) = if (value == "A4") A4 else A5 }
}

data class PrintQr(val size: Int, val modules: List<Int>)
data class PrintSheetData(val title: String, val subtitle: String?, val items: List<String>, val footer: String?, val qr: PrintQr? = null)

sealed interface PrintDraw {
    data class Text(val value: String, val x: Float, val top: Float, val size: Float, val bold: Boolean = false) : PrintDraw
    data class Box(val x: Float, val top: Float, val size: Float) : PrintDraw
    data class Qr(val matrix: PrintQr, val x: Float, val top: Float, val edge: Float) : PrintDraw
}
data class PrintPage(val commands: List<PrintDraw>)

/** Pure pagination; the PDF renderer supplies the real system-font width measurement. */
object PrintPaginator {
    const val MARGIN = 29f

    fun wrap(text: String, width: Float, measure: (String) -> Float): List<String> {
        require(width > 0)
        val lines = mutableListOf<String>()
        for (paragraph in text.replace("\r\n", "\n").replace('\r', '\n').split('\n')) {
            if (paragraph.isEmpty()) { lines.add(""); continue }
            var line = ""
            val words = BreakIterator.getLineInstance(Locale.GERMAN).apply { setText(paragraph) }
            var start = words.first()
            var end = words.next()
            while (end != BreakIterator.DONE) {
                val word = paragraph.substring(start, end)
                val candidate = line + word
                if (measure(candidate.trimEnd()) <= width) line = candidate
                else {
                    if (line.isNotBlank()) lines.add(line.trimEnd())
                    line = ""
                    val chunk = word.trimStart()
                    val chars = BreakIterator.getCharacterInstance(Locale.GERMAN).apply { setText(chunk) }
                    var charStart = chars.first()
                    var charEnd = chars.next()
                    while (charEnd != BreakIterator.DONE) {
                        val character = chunk.substring(charStart, charEnd)
                        if (line.isNotEmpty() && measure(line + character) > width) { lines.add(line.trimEnd()); line = "" }
                        line += character
                        charStart = charEnd; charEnd = chars.next()
                    }
                }
                start = end; end = words.next()
            }
            if (line.isNotEmpty()) lines.add(line.trimEnd())
        }
        return lines
    }

    fun layout(sheets: List<PrintSheetData>, paper: PrintPaper, fontScale: Float, measure: (String, Float, Boolean) -> Float): List<PrintPage> {
        val scale = fontScale.coerceIn(0.85f, 2f)
        val width = paper.width - 2 * MARGIN
        val bottom = paper.height - MARGIN
        val pages = mutableListOf<PrintPage>()
        var commands = mutableListOf<PrintDraw>()
        var top = MARGIN
        fun nextPage() {
            if (commands.isNotEmpty()) pages.add(PrintPage(commands.toList()))
            commands = mutableListOf(); top = MARGIN
        }
        fun space(height: Float) { if (top + height > bottom) nextPage() }
        fun text(value: String, size: Float, bold: Boolean = false) {
            val leading = size * 1.4f
            for (line in wrap(value, width) { measure(it, size, bold) }) {
                space(leading)
                commands.add(PrintDraw.Text(line, MARGIN, top, size, bold)); top += leading
            }
            top += 8
        }
        for ((index, sheet) in sheets.withIndex()) {
            if (index > 0) nextPage()
            text(sheet.title, 24 * scale, true)
            sheet.subtitle?.takeIf { it.isNotEmpty() }?.let { text(it, 14 * scale) }
            if (sheet.qr != null) {
                val edge = minOf(240f, width)
                space(edge)
                commands.add(PrintDraw.Qr(sheet.qr, (paper.width - edge) / 2, top, edge)); top += edge + 16
            } else {
                val size = 17 * scale
                val leading = size * 1.4f
                val box = 14 * scale
                val indent = box + 12
                for (item in sheet.items) {
                    val lines = wrap(item, width - indent) { measure(it, size, false) }.ifEmpty { listOf("") }
                    // Keep ordinary steps together, while very long steps may continue on later pages.
                    if (lines.size * leading <= bottom - MARGIN) space(lines.size * leading)
                    for ((lineIndex, line) in lines.withIndex()) {
                        space(leading)
                        if (lineIndex == 0) commands.add(PrintDraw.Box(MARGIN, top + (leading - box) / 2, box))
                        commands.add(PrintDraw.Text(line, MARGIN + indent, top, size)); top += leading
                    }
                    top += 8
                }
            }
            sheet.footer?.takeIf { it.isNotEmpty() }?.let { text(it, 13 * scale) }
        }
        if (commands.isNotEmpty()) pages.add(PrintPage(commands.toList()))
        return pages
    }
}

/** Fully local HTML for a dedicated printing WebView, with no app navigation or external assets. */
object PrintHtml {
    private fun escape(value: String) = value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;")

    fun document(sheets: List<PrintSheetData>, paper: PrintPaper, fontScale: Float): String = buildString {
        val scale = fontScale.coerceIn(0.85f, 2f)
        append("<!doctype html><html lang=\"de\"><head><meta charset=\"UTF-8\"><style>")
        append("@page{size:${paper.name};margin:10mm}body{margin:0;background:#fff;color:#000;font-family:sans-serif;font-size:${17 * scale}pt;line-height:1.4}h1{font-size:${24 * scale}pt;line-height:1.3;margin:0 0 8pt}p{margin:0 0 12pt;white-space:pre-wrap;overflow-wrap:anywhere}.subtitle,.footer{font-size:${14 * scale}pt}section{break-after:page}section:last-child{break-after:auto}ul{list-style:none;margin:12pt 0;padding:0}li{position:relative;padding-left:${14 * scale + 12}pt;margin-bottom:10pt;break-inside:avoid;overflow-wrap:anywhere;white-space:pre-wrap}.box{position:absolute;left:0;top:4pt;width:${14 * scale}pt;height:${14 * scale}pt;border:1.5pt solid #000;box-sizing:border-box}.qr{display:block;width:240pt;max-width:100%;margin:16pt auto;break-inside:avoid}")
        append("</style></head><body>")
        for (sheet in sheets) {
            append("<section><h1>${escape(sheet.title)}</h1>")
            sheet.subtitle?.let { append("<p class=\"subtitle\">${escape(it)}</p>") }
            val qr = sheet.qr
            if (qr != null) {
                val edge = qr.size + 8
                append("<svg class=\"qr\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 $edge $edge\" shape-rendering=\"crispEdges\"><rect width=\"$edge\" height=\"$edge\" fill=\"white\"/>")
                for (y in 0 until qr.size) for (x in 0 until qr.size) if (qr.modules[y * qr.size + x] == 1) append("<rect x=\"${x + 4}\" y=\"${y + 4}\" width=\"1\" height=\"1\" fill=\"black\"/>")
                append("</svg>")
            } else {
                append("<ul>")
                sheet.items.forEach { append("<li><span class=\"box\"></span>${escape(it)}</li>") }
                append("</ul>")
            }
            sheet.footer?.let { append("<p class=\"footer\">${escape(it)}</p>") }
            append("</section>")
        }
        append("</body></html>")
    }
}
