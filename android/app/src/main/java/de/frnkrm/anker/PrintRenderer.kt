package de.frnkrm.anker

import android.app.Activity
import android.content.Context
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import android.os.Bundle
import android.os.CancellationSignal
import android.os.Handler
import android.os.Looper
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintJob
import android.print.PrintManager
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONArray
import java.io.File

/** Two local renderers of the same selected sheets. Never prints or destroys the app's WebView. */
object PrintRenderer {
    fun readSheets(array: JSONArray): List<PrintSheetData> {
        require(array.length() in 1..5)
        var characters = 0
        fun text(value: String): String { characters += value.length; require(characters <= 100_000); return value }
        return (0 until array.length()).map { index ->
            val sheet = array.getJSONObject(index)
            val title = text(sheet.getString("title"))
            val subtitle = sheet.optString("subtitle").takeIf { it.isNotEmpty() }?.let(::text)
            val footer = sheet.optString("footer").takeIf { it.isNotEmpty() }?.let(::text)
            when (sheet.getString("kind")) {
                "list" -> {
                    val items = sheet.getJSONArray("items")
                    require(items.length() <= 1000)
                    PrintSheetData(title, subtitle, (0 until items.length()).map { text(items.getString(it)) }, footer)
                }
                "qr" -> {
                    val qr = sheet.getJSONObject("qr")
                    val size = qr.getInt("size")
                    require(size in 21..177 && (size - 21) % 4 == 0)
                    val data = qr.getJSONArray("modules")
                    require(data.length() == size * size)
                    val modules = (0 until data.length()).map { data.getInt(it).also { bit -> require(bit == 0 || bit == 1) } }
                    PrintSheetData(title, subtitle, emptyList(), footer, PrintQr(size, modules))
                }
                else -> throw IllegalArgumentException("Unknown print sheet")
            }
        }
    }

    fun openDialog(activity: Activity, name: String, sheets: List<PrintSheetData>, paper: PrintPaper, fontScale: Float, result: (Boolean) -> Unit) {
        if (activity.isFinishing || activity.isDestroyed) { result(false); return }
        val manager = activity.getSystemService(PrintManager::class.java)
        if (manager == null) { result(false); return }
        val handler = Handler(Looper.getMainLooper())
        val web = try { WebView(activity) } catch (_: Exception) { result(false); return }
        var answered = false
        var released = false
        var job: PrintJob? = null
        fun releaseWebView() { if (!released) { released = true; try { web.destroy() } catch (_: Exception) { } } }
        fun fail() { if (!answered) { answered = true; releaseWebView(); result(false) } }
        val timeout = Runnable { fail() }
        try {
            web.setBackgroundColor(Color.WHITE)
            web.settings.javaScriptEnabled = false
            web.settings.blockNetworkLoads = true
            web.settings.allowFileAccess = false
            web.settings.allowContentAccess = false
            web.webViewClient = object : WebViewClient() {
                override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                    handler.removeCallbacks(timeout)
                    if (!answered) fail() else { try { job?.cancel() } catch (_: Exception) { }; releaseWebView() }
                    return true
                }
                override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                    if (request.isForMainFrame) { handler.removeCallbacks(timeout); fail() }
                }
                override fun onPageFinished(view: WebView, url: String?) {
                    if (answered) return
                    handler.removeCallbacks(timeout)
                    if (activity.isFinishing || activity.isDestroyed) { fail(); return }
                    try {
                        // Only inline text/SVG and Android's local system font are used; no asynchronous assets.
                        val delegate = web.createPrintDocumentAdapter(name)
                        val adapter = object : PrintDocumentAdapter() {
                            override fun onStart() = delegate.onStart()
                            override fun onLayout(oldAttributes: PrintAttributes?, newAttributes: PrintAttributes?, cancellationSignal: CancellationSignal?, callback: LayoutResultCallback?, extras: Bundle?) =
                                delegate.onLayout(oldAttributes, newAttributes, cancellationSignal, callback, extras)
                            override fun onWrite(pages: Array<out PageRange>?, destination: ParcelFileDescriptor?, cancellationSignal: CancellationSignal?, callback: WriteResultCallback?) =
                                delegate.onWrite(pages, destination, cancellationSignal, callback)
                            override fun onFinish() {
                                try { delegate.onFinish() } finally { activity.runOnUiThread { releaseWebView() } }
                            }
                        }
                        val attrs = PrintAttributes.Builder()
                            .setMediaSize(if (paper == PrintPaper.A4) PrintAttributes.MediaSize.ISO_A4 else PrintAttributes.MediaSize.ISO_A5)
                            .setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME).build()
                        job = manager.print(name, adapter, attrs)
                        if (job == null) fail() else { answered = true; result(true) }
                    } catch (_: Exception) { fail() }
                }
            }
            handler.postDelayed(timeout, 10_000)
            web.loadDataWithBaseURL(null, PrintHtml.document(sheets, paper, fontScale), "text/html", "UTF-8", null)
        } catch (_: Exception) { handler.removeCallbacks(timeout); fail() }
    }

    data class Export(val file: File, val pages: Int)

    /** Framework PDF file, independent of WebView, PrintManager and installed print services. */
    fun exportPdf(context: Context, sheets: List<PrintSheetData>, paper: PrintPaper, fontScale: Float): Export {
        val text = Paint(Paint.ANTI_ALIAS_FLAG)
        fun configure(size: Float, bold: Boolean) {
            text.textSize = size; text.typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
            text.color = Color.BLACK; text.style = Paint.Style.FILL
        }
        val pages = PrintPaginator.layout(sheets, paper, fontScale) { value, size, bold -> configure(size, bold); text.measureText(value) }
        require(pages.isNotEmpty())
        val file = File.createTempFile("anker-druck-", ".pdf", context.cacheDir)
        val document = try { PdfDocument() } catch (error: Exception) { file.delete(); throw error }
        try {
            for ((index, content) in pages.withIndex()) {
                val page = document.startPage(PdfDocument.PageInfo.Builder(paper.width, paper.height, index + 1).create())
                try {
                    val canvas = page.canvas
                    canvas.drawColor(Color.WHITE)
                    for (command in content.commands) when (command) {
                        is PrintDraw.Text -> {
                            configure(command.size, command.bold)
                            canvas.drawText(command.value, command.x, command.top - text.fontMetrics.ascent, text)
                        }
                        is PrintDraw.Box -> {
                            text.color = Color.BLACK; text.style = Paint.Style.STROKE; text.strokeWidth = 1.5f
                            canvas.drawRect(command.x, command.top, command.x + command.size, command.top + command.size, text)
                        }
                        is PrintDraw.Qr -> {
                            val matrix = command.matrix
                            val unit = command.edge / (matrix.size + 8)
                            text.color = Color.BLACK; text.style = Paint.Style.FILL; text.isAntiAlias = false
                            for (y in 0 until matrix.size) for (x in 0 until matrix.size) if (matrix.modules[y * matrix.size + x] == 1) {
                                val left = command.x + (x + 4) * unit; val top = command.top + (y + 4) * unit
                                canvas.drawRect(left, top, left + unit, top + unit, text)
                            }
                            text.isAntiAlias = true
                        }
                    }
                } finally { document.finishPage(page) }
            }
            file.outputStream().use { document.writeTo(it) }
            return Export(file, pages.size)
        } catch (error: Exception) { file.delete(); throw error }
        finally { document.close() }
    }
}
