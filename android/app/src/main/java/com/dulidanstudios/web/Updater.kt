package com.dulidanstudios.web

/* Dulidan Web Android · Updates: liest android-version.json aus dem GitHub-Release, lädt die neue APK mit dem
   DownloadManager und öffnet den System-Installer. Passt der Signierschlüssel nicht (alter Einmal-Schlüssel),
   sagt die App ehrlich, dass dieses eine Mal neu installiert werden muss. */

import android.app.Activity
import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import kotlin.concurrent.thread

class Updater(private val act: Activity, private val ui: (State) -> Unit) {
    sealed class State {
        data class Available(val name: String, val sameKey: Boolean) : State()
        data class Loading(val percent: Int) : State()
        object Ready : State()
        data class Failed(val msg: String) : State()
    }

    private val base = "https://github.com/short1106/dasdfasfasf/releases/download/android-latest/"
    private val h = Handler(Looper.getMainLooper())
    private val prefs = act.getSharedPreferences("dw", Context.MODE_PRIVATE)
    private var info: JSONObject? = null
    private var dlId = -1L

    private fun installedCode(): Long = act.packageManager.getPackageInfo(act.packageName, 0).longVersionCode

    /* SHA-256 des eigenen Signierzertifikats, klein und ohne Doppelpunkte (wie keytool im Build) */
    private fun ownCert(): String = try {
        val sig = if (android.os.Build.VERSION.SDK_INT >= 28)
            act.packageManager.getPackageInfo(act.packageName, PackageManager.GET_SIGNING_CERTIFICATES).signingInfo!!.apkContentsSigners[0]
        else @Suppress("DEPRECATION") act.packageManager.getPackageInfo(act.packageName, PackageManager.GET_SIGNATURES).signatures!![0]
        MessageDigest.getInstance("SHA-256").digest(sig.toByteArray()).joinToString("") { "%02x".format(it) }
    } catch (_: Exception) { "" }

    /* Höchstens alle 6 Stunden nachsehen (oder sofort, wenn force) */
    fun check(force: Boolean = false) {
        val now = System.currentTimeMillis()
        if (!force && now - prefs.getLong("updCheck", 0) < 6 * 3600_000L) return
        prefs.edit().putLong("updCheck", now).apply()
        thread(isDaemon = true) {
            val j = try {
                val c = URL(base + "android-version.json").openConnection() as HttpURLConnection
                c.connectTimeout = 6000; c.readTimeout = 6000; c.instanceFollowRedirects = true
                JSONObject(c.inputStream.bufferedReader().use { it.readText() }).also { c.disconnect() }
            } catch (_: Exception) { null }
            h.post {
                if (j == null) { if (force) ui(State.Failed("Update-Server nicht erreichbar")); return@post }
                info = j
                if (j.optLong("versionCode") > installedCode()) ui(State.Available(j.optString("versionName"), j.optString("cert") == ownCert()))
                else if (force) ui(State.Failed("Du hast schon die neueste Version (${act.packageManager.getPackageInfo(act.packageName, 0).versionName})"))
            }
        }
    }

    fun download() {
        val j = info ?: return
        /* Ohne Erlaubnis für "Unbekannte Apps" kann Android die APK nicht installieren: einmal in die Einstellungen */
        if (!act.packageManager.canRequestPackageInstalls()) {
            try { act.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + act.packageName))) } catch (_: Exception) {}
            ui(State.Failed("Erlaube „Apps installieren“ für Dulidan Web und tippe dann nochmal auf Update"))
            return
        }
        val dm = act.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        val name = "DulidanWeb-${j.optLong("versionCode")}.apk"
        act.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS)?.listFiles()?.forEach { if (it.name.endsWith(".apk")) it.delete() }   // alte Update-Dateien weg
        dlId = dm.enqueue(DownloadManager.Request(Uri.parse(base + "DulidanWeb.apk"))
            .setTitle("Dulidan Web ${j.optString("versionName")}")
            .setMimeType("application/vnd.android.package-archive")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
            .setDestinationInExternalFilesDir(act, Environment.DIRECTORY_DOWNLOADS, name))
        ui(State.Loading(0))
        poll(dm)
    }

    private fun poll(dm: DownloadManager) {
        val c = dm.query(DownloadManager.Query().setFilterById(dlId)) ?: return
        c.use {
            if (!it.moveToFirst()) { ui(State.Failed("Download abgebrochen")); return }
            val st = it.getInt(it.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
            val done = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR))
            val total = it.getLong(it.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
            when (st) {
                DownloadManager.STATUS_SUCCESSFUL -> { ui(State.Ready); install(dm) }
                DownloadManager.STATUS_FAILED -> ui(State.Failed("Download fehlgeschlagen"))
                else -> { ui(State.Loading(if (total > 0) (done * 100 / total).toInt() else 0)); h.postDelayed({ poll(dm) }, 500) }
            }
        }
    }

    fun install(dm: DownloadManager = act.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager) {
        val uri = dm.getUriForDownloadedFile(dlId) ?: return ui(State.Failed("Datei nicht gefunden"))
        try {
            act.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (_: Exception) { ui(State.Failed("Installer ließ sich nicht öffnen")) }
    }
}
