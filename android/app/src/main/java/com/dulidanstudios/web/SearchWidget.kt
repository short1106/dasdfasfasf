package com.dulidanstudios.web

/* Dulidan Web Android · Suchleisten-Widget für den Startbildschirm: Tippen = Suche mit Tastatur, Mikro = Sprachsuche, Rechner */

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class SearchWidget : AppWidgetProvider() {
    override fun onUpdate(ctx: Context, mgr: AppWidgetManager, ids: IntArray) {
        val v = RemoteViews(ctx.packageName, R.layout.widget_search)
        v.setOnClickPendingIntent(R.id.w_root, open(ctx, ACTION_SEARCH, 1))
        v.setOnClickPendingIntent(R.id.w_search, open(ctx, ACTION_SEARCH, 1))
        v.setOnClickPendingIntent(R.id.w_logo, open(ctx, Intent.ACTION_MAIN, 2))
        v.setOnClickPendingIntent(R.id.w_mic, open(ctx, ACTION_VOICE, 3))
        v.setOnClickPendingIntent(R.id.w_calc, open(ctx, ACTION_CALC, 4))
        mgr.updateAppWidget(ids, v)
    }

    companion object {
        const val ACTION_SEARCH = "com.dulidanstudios.web.SEARCH"
        const val ACTION_VOICE = "com.dulidanstudios.web.VOICE"
        const val ACTION_CALC = "com.dulidanstudios.web.CALC"

        private fun open(ctx: Context, action: String, code: Int): PendingIntent =
            PendingIntent.getActivity(ctx, code, Intent(ctx, MainActivity::class.java).setAction(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

        /* Aus dem Menü: Launcher fragt, ob das Widget abgelegt werden soll */
        fun pin(ctx: Context): Boolean {
            val mgr = ctx.getSystemService(AppWidgetManager::class.java) ?: return false
            if (!mgr.isRequestPinAppWidgetSupported) return false
            return mgr.requestPinAppWidget(ComponentName(ctx, SearchWidget::class.java), null, null)
        }
    }
}
