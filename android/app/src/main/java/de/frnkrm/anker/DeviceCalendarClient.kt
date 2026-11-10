package de.frnkrm.anker

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.provider.CalendarContract
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

/** Read-only Android CalendarProvider adapter. Nothing is uploaded or written to a calendar. */
object DeviceCalendarClient {
    fun granted(ctx: Context): Boolean = ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_CALENDAR) == PackageManager.PERMISSION_GRANTED

    private fun permitted(ctx: Context) { check(granted(ctx)) { "DEVICE_CALENDAR_PERMISSION_REQUIRED" } }

    fun calendars(ctx: Context): JSONObject {
        permitted(ctx)
        val items = JSONArray()
        val projection = arrayOf(CalendarContract.Calendars._ID, CalendarContract.Calendars.CALENDAR_DISPLAY_NAME,
            CalendarContract.Calendars.ACCOUNT_NAME)
        ctx.contentResolver.query(CalendarContract.Calendars.CONTENT_URI, projection,
            "${CalendarContract.Calendars.ACCOUNT_TYPE} = ? AND ${CalendarContract.Calendars.SYNC_EVENTS} = ?",
            arrayOf("com.google", "1"), null)?.use { cursor ->
            while (cursor.moveToNext()) {
                check(items.length() < 100) { "DEVICE_CALENDAR_LIMIT" }
                val id = cursor.getLong(0)
                val account = cursor.getString(2).orEmpty()
                if (id <= 0 || account.isBlank()) continue
                items.put(JSONObject().put("id", DeviceCalendarModel.selectionKey(id, account))
                    .put("name", cursor.getString(1)?.take(300).orEmpty().ifBlank { "Google-Kalender" })
                    .put("account", account.take(300)))
            }
        } ?: error("DEVICE_CALENDAR_UNAVAILABLE")
        return JSONObject().put("calendars", items)
    }

    fun events(ctx: Context, selected: List<String>, from: Long, to: Long): JSONObject {
        permitted(ctx)
        DeviceCalendarModel.window(from, to)
        val selections = DeviceCalendarModel.selections(selected)
        val selectedKeys = selected.toSet()
        // Recheck identity on every read: an id recycled for another account is not consent.
        val available = calendars(ctx).getJSONArray("calendars")
        val actualKeys = (0 until available.length()).map { available.getJSONObject(it).getString("id") }.toSet()
        check(selected.all { it in actualKeys }) { "DEVICE_CALENDAR_SELECTION_CHANGED" }
        val uri = CalendarContract.Instances.CONTENT_URI.buildUpon().also {
            ContentUris.appendId(it, from); ContentUris.appendId(it, to)
        }.build()
        val projection = arrayOf(CalendarContract.Instances.CALENDAR_ID, CalendarContract.Instances.EVENT_ID,
            CalendarContract.Instances.BEGIN, CalendarContract.Instances.END, CalendarContract.Instances.TITLE,
            CalendarContract.Instances.ALL_DAY, CalendarContract.Events.ACCOUNT_NAME,
            CalendarContract.Events.ACCOUNT_TYPE, CalendarContract.Events.STATUS)
        val placeholders = selections.joinToString(",") { "?" }
        val arguments = (selections.map { it.id.toString() } + "com.google").toTypedArray()
        val result = JSONArray()
        ctx.contentResolver.query(uri, projection,
            "${CalendarContract.Instances.CALENDAR_ID} IN ($placeholders) AND ${CalendarContract.Events.ACCOUNT_TYPE} = ?",
            arguments, CalendarContract.Instances.BEGIN + " ASC")?.use { cursor ->
            var scanned = 0
            while (cursor.moveToNext()) {
                check(++scanned <= DeviceCalendarModel.MAX_EVENTS) { "DEVICE_CALENDAR_LIMIT" }
                // IDs can be recycled while accounts synchronize. Bind the event to
                // its own row, never only to an earlier calendars-list response.
                val selectionId = DeviceCalendarModel.selectedKeyForRow(cursor.getLong(0), cursor.getString(7), cursor.getString(6), selectedKeys)
                val status = if (cursor.isNull(8)) null else cursor.getInt(8)
                if (!DeviceCalendarModel.includeEventStatus(status, CalendarContract.Events.STATUS_CANCELED)) continue
                val begin = cursor.getLong(2)
                val end = cursor.getLong(3)
                check(begin >= 0 && end > begin) { "DEVICE_CALENDAR_EVENT_INVALID" }
                val allDay = cursor.getInt(5) != 0
                val event = JSONObject().put("id", DeviceCalendarModel.eventId(selectionId, cursor.getLong(1), begin))
                    .put("title", cursor.getString(4)?.take(500).orEmpty().ifBlank { "Termin" })
                    .put("start", begin).put("end", end).put("allDay", allDay)
                if (allDay) event.put("startDate", DeviceCalendarModel.allDayDate(begin)).put("endDate", DeviceCalendarModel.allDayDate(end))
                result.put(event)
            }
        } ?: error("DEVICE_CALENDAR_UNAVAILABLE")
        // A changed account during cursor iteration also invalidates an empty or
        // otherwise apparently valid result. The caller retains its earlier cache.
        val after = calendars(ctx).getJSONArray("calendars")
        val remainingKeys = (0 until after.length()).map { after.getJSONObject(it).getString("id") }.toSet()
        check(selected.all { it in remainingKeys }) { "DEVICE_CALENDAR_SELECTION_CHANGED" }
        return JSONObject().put("events", result).put("readAt", System.currentTimeMillis())
    }
}
