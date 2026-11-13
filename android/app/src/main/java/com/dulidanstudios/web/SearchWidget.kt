package com.dulidanstudios.web

/* Dulidan Web Android · Suchleisten-Widget für den Startbildschirm: Tippen = Suche mit Tastatur, Mikro = Sprachsuche, Rechner.
   Farbe frei wählbar (wie die App, ein Akzent oder eigene Farbe aus dem Spektrum): Rand, Knöpfe und Schrift
   werden als Bild in genau dieser Farbe gezeichnet, weil sich Verläufe in RemoteViews nicht umfärben lassen. */

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.os.Bundle
import android.widget.RemoteViews

class SearchWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) { for (id in ids) draw(ctx, mgr, id) }
    override fun onAppWidgetOptionsChanged(ctx: Context, mgr: AppWidgetManager, id: Int, o: Bundle) { draw(ctx, mgr, id) }

    companion object {
        const val ACTION_SEARCH = "com.dulidanstudios.web.SEARCH"
        const val ACTION_VOICE = "com.dulidanstudios.web.VOICE"
        const val ACTION_CALC = "com.dulidanstudios.web.CALC"

        private fun open(ctx: Context, action: String, code: Int): PendingIntent =
            PendingIntent.getActivity(ctx, code, Intent(ctx, MainActivity::class.java).setAction(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

        /* Alle Widgets neu zeichnen (nach Farbwechsel in der App) */
        fun refresh(ctx: Context) {
            val mgr = ctx.getSystemService(AppWidgetManager::class.java) ?: return
            for (id in mgr.getAppWidgetIds(ComponentName(ctx, SearchWidget::class.java))) draw(ctx, mgr, id)
        }

        private fun draw(ctx: Context, mgr: AppWidgetManager, id: Int) {
            val (vio, mag, pink) = Store(ctx).widgetTones()
            val d = ctx.resources.displayMetrics.density
            val o = mgr.getAppWidgetOptions(id)
            val wDp = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH).takeIf { it > 0 } ?: 320
            val hDp = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT).takeIf { it > 0 } ?: 60
            val v = RemoteViews(ctx.packageName, R.layout.widget_search)
            try {
                v.setImageViewBitmap(R.id.w_bg, pill((wDp * d).toInt().coerceIn(120, 1400), (minOf(hDp, 90) * d).toInt().coerceIn(40, 260), d, vio, mag, pink))
                v.setImageViewBitmap(R.id.w_mic, circle((44 * d).toInt(), vio, mag, ctx, R.drawable.ic_w_mic, android.graphics.Color.WHITE, true))
                v.setImageViewBitmap(R.id.w_calc, circle((40 * d).toInt(), pink, pink, ctx, R.drawable.ic_w_calc, pink, false))
                v.setInt(R.id.w_mic, "setBackgroundResource", 0); v.setInt(R.id.w_calc, "setBackgroundResource", 0)
                v.setViewPadding(R.id.w_mic, 0, 0, 0, 0); v.setViewPadding(R.id.w_calc, 0, 0, 0, 0)
            } catch (_: Throwable) { /* zu wenig Speicher: dann bleibt die Standardoptik */ }
            v.setTextColor(R.id.w_sub, pink)
            v.setOnClickPendingIntent(R.id.w_root, open(ctx, ACTION_SEARCH, 1))
            v.setOnClickPendingIntent(R.id.w_search, open(ctx, ACTION_SEARCH, 1))
            v.setOnClickPendingIntent(R.id.w_logo, open(ctx, Intent.ACTION_MAIN, 2))
            v.setOnClickPendingIntent(R.id.w_mic, open(ctx, ACTION_VOICE, 3))
            v.setOnClickPendingIntent(R.id.w_calc, open(ctx, ACTION_CALC, 4))
            mgr.updateAppWidget(id, v)
        }

        /* Dunkle Pille mit leuchtendem Verlaufsrand (vio → mag → pink) */
        private fun pill(w: Int, h: Int, d: Float, vio: Int, mag: Int, pink: Int): Bitmap {
            val b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
            val c = Canvas(b); val p = Paint(Paint.ANTI_ALIAS_FLAG)
            val r = RectF(0f, 0f, w.toFloat(), h.toFloat()); val rad = h / 2f
            p.shader = LinearGradient(0f, 0f, w.toFloat(), 0f, intArrayOf(vio, mag, pink), null, Shader.TileMode.CLAMP)
            c.drawRoundRect(r, rad, rad, p)
            val e = 1.6f * d; r.inset(e, e)
            p.shader = LinearGradient(0f, 0f, 0f, h.toFloat(), intArrayOf(0xF2151022.toInt(), 0xF207060B.toInt()), null, Shader.TileMode.CLAMP)
            c.drawRoundRect(r, rad - e, rad - e, p)
            /* zarter Schimmer der Farbe innen links */
            p.shader = LinearGradient(0f, 0f, w * 0.6f, 0f, intArrayOf(Dw.alpha(mag, 0.22f), 0), null, Shader.TileMode.CLAMP)
            c.drawRoundRect(r, rad - e, rad - e, p)
            return b
        }

        /* Runder Knopf: voller Verlauf (Mikro) oder zarter Ring (Rechner), Symbol eingefärbt */
        private fun circle(s: Int, a: Int, bCol: Int, ctx: Context, icon: Int, iconCol: Int, filled: Boolean): Bitmap {
            val b = Bitmap.createBitmap(s, s, Bitmap.Config.ARGB_8888)
            val c = Canvas(b); val p = Paint(Paint.ANTI_ALIAS_FLAG)
            if (filled) { p.shader = LinearGradient(0f, 0f, s.toFloat(), s.toFloat(), a, bCol, Shader.TileMode.CLAMP); c.drawCircle(s / 2f, s / 2f, s / 2f, p) }
            else {
                p.color = Dw.alpha(a, 0.14f); c.drawCircle(s / 2f, s / 2f, s / 2f, p)
                p.style = Paint.Style.STROKE; p.strokeWidth = s * 0.025f; p.color = Dw.alpha(a, 0.4f); c.drawCircle(s / 2f, s / 2f, s / 2f - p.strokeWidth, p)
            }
            ctx.getDrawable(icon)?.mutate()?.let { dr ->
                val pad = (s * 0.23f).toInt()
                dr.setBounds(pad, pad, s - pad, s - pad); dr.setTint(iconCol); dr.draw(c)
            }
            return b
        }

        /* Aus dem Menü: Launcher fragt, ob das Widget abgelegt werden soll */
        fun pin(ctx: Context): Boolean {
            val mgr = ctx.getSystemService(AppWidgetManager::class.java) ?: return false
            if (!mgr.isRequestPinAppWidgetSupported) return false
            return mgr.requestPinAppWidget(ComponentName(ctx, SearchWidget::class.java), null, null)
        }
    }
}
