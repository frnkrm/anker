package de.frnkrm.anker

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import org.json.JSONArray

/**
 * Homescreen-Widget: nächste Aktion + nächste harte Uhrzeit, Knopf für die Gedanken-Inbox.
 * Die App liefert eine Zeitleiste; das Widget wählt selbst den passenden Eintrag,
 * damit es auch bei geschlossener App stimmt.
 */
class AnkerWidget : AppWidgetProvider() {
    companion object {
        private const val ACTION_REFRESH = "de.frnkrm.anker.WIDGET_REFRESH"

        fun refreshAll(ctx: Context) {
            val mgr = AppWidgetManager.getInstance(ctx)
            val ids = mgr.getAppWidgetIds(ComponentName(ctx, AnkerWidget::class.java))
            if (ids.isNotEmpty()) render(ctx, mgr, ids)
        }

        private data class Entry(val at: Long, val action: String, val sub: String, val hardLabel: String, val hardTime: String)

        private fun entries(ctx: Context): List<Entry> = try {
            val arr = JSONArray(AnkerPrefs.widgetEntries(ctx))
            (0 until arr.length()).map {
                val o = arr.getJSONObject(it)
                Entry(o.getLong("at"), o.optString("action"), o.optString("sub"), o.optString("hardLabel"), o.optString("hardTime"))
            }.sortedBy { it.at }
        } catch (_: Exception) {
            emptyList()
        }

        private fun deepLink(ctx: Context, path: String, req: Int): PendingIntent {
            val i = Intent(Intent.ACTION_VIEW, Uri.parse("${ctx.packageName}://$path"))
                .setPackage(ctx.packageName)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            return PendingIntent.getActivity(ctx, req, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        }

        private fun render(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
            val now = System.currentTimeMillis()
            val all = entries(ctx)
            val cur = all.lastOrNull { it.at <= now }
            val next = all.firstOrNull { it.at > now }

            val v = RemoteViews(ctx.packageName, R.layout.widget_anker)
            v.setTextViewText(R.id.widget_action, cur?.action ?: "Anker öffnen")
            v.setTextViewText(R.id.widget_sub, cur?.sub ?: "")
            v.setTextViewText(R.id.widget_hard, if (cur != null && cur.hardLabel.isNotEmpty()) "${cur.hardLabel} ${cur.hardTime}" else "")
            v.setOnClickPendingIntent(R.id.widget_root, deepLink(ctx, "now", 1))
            v.setOnClickPendingIntent(R.id.widget_inbox, deepLink(ctx, "inbox", 2))
            mgr.updateAppWidget(ids, v)

            // Beim nächsten Eintrag neu zeichnen (ungenau reicht, spart Akku)
            if (next != null) {
                val pi = PendingIntent.getBroadcast(
                    ctx, 3, Intent(ctx, AnkerWidget::class.java).setAction(ACTION_REFRESH),
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
                ctx.getSystemService(AlarmManager::class.java)?.set(AlarmManager.RTC, next.at, pi)
            }
        }
    }

    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) = render(ctx, mgr, ids)

    override fun onReceive(ctx: Context, intent: Intent) {
        super.onReceive(ctx, intent)
        if (intent.action == ACTION_REFRESH) refreshAll(ctx)
    }
}
