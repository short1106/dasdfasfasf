package com.dulidanstudios.web

/* Dulidan Web Android · Updates: liest android-version.json aus dem GitHub-Release, lädt neue Versionen im WLAN
   automatisch im Hintergrund und installiert sie über den PackageInstaller. Ab Android 12 geht das ohne Nachfrage,
   sobald die App sich einmal selbst aktualisiert hat (sie ist dann „Installer“ ihrer selbst), sonst bestätigt man einmal.
   Im Mobilfunknetz fragt sie vorher. Passt der Signierschlüssel nicht (alter Einmal-Schlüssel),
   sagt die App ehrlich, dass dieses eine Mal neu installiert werden muss. */

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import kotlin.concurrent.thread

class Updater(private val act: Activity, private val ui: (State) -> Unit) {
    sealed class State {
        data class Available(val name: String, val sameKey: Boolean) : State()
        data class Loading(val percent: Int) : State()
        object Installing : State()
        object NeedsPermission : State()
        data class Failed(val msg: String) : State()
    }

    private val base = "https://github.com/short1106/dasdfasfasf/releases/download/android-latest/"
    private val h = Handler(Looper.getMainLooper())
    private val prefs = act.getSharedPreferences("dw", Context.MODE_PRIVATE)
    private var info: JSONObject? = null
    @Volatile private var busy = false

    private fun installedCode(): Long = act.packageManager.getPackageInfo(act.packageName, 0).longVersionCode

    /* SHA-256 des eigenen Signierzertifikats, klein und ohne Doppelpunkte (wie keytool im Build) */
    private fun ownCert(): String = try {
        val sig = if (Build.VERSION.SDK_INT >= 28)
            act.packageManager.getPackageInfo(act.packageName, PackageManager.GET_SIGNING_CERTIFICATES).signingInfo!!.apkContentsSigners[0]
        else @Suppress("DEPRECATION") act.packageManager.getPackageInfo(act.packageName, PackageManager.GET_SIGNATURES).signatures!![0]
        MessageDigest.getInstance("SHA-256").digest(sig.toByteArray()).joinToString("") { "%02x".format(it) }
    } catch (_: Exception) { "" }

    private fun unmetered(): Boolean = try {
        !(act.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager).isActiveNetworkMetered
    } catch (_: Exception) { false }

    /* Höchstens alle 3 Stunden nachsehen (oder sofort, wenn force). Im WLAN wird direkt geladen und installiert. */
    fun check(force: Boolean = false) {
        if (busy) return
        val now = System.currentTimeMillis()
        if (!force && now - prefs.getLong("updCheck", 0) < 3 * 3600_000L) return
        prefs.edit().putLong("updCheck", now).apply()
        prefs.getString("updError", null)?.let { prefs.edit().remove("updError").apply(); h.post { ui(State.Failed(it)) } }
        thread(isDaemon = true) {
            val j = try {
                val c = URL(base + "android-version.json").openConnection() as HttpURLConnection
                c.connectTimeout = 6000; c.readTimeout = 6000; c.instanceFollowRedirects = true
                JSONObject(c.inputStream.bufferedReader().use { it.readText() }).also { c.disconnect() }
            } catch (_: Exception) { null }
            h.post {
                if (j == null) { if (force) ui(State.Failed("Update-Server nicht erreichbar")); return@post }
                info = j
                if (j.optLong("versionCode") <= installedCode()) {
                    if (force) ui(State.Failed("Du hast schon die neueste Version (${act.packageManager.getPackageInfo(act.packageName, 0).versionName})"))
                    return@post
                }
                val same = j.optString("cert") == ownCert()
                if (same && (unmetered() || force)) download() else ui(State.Available(j.optString("versionName"), same))
            }
        }
    }

    /* APK in den Cache laden (Fortschritt in der Pille), dann installieren */
    fun download() {
        val j = info ?: return
        if (busy) return
        if (!act.packageManager.canRequestPackageInstalls()) { ui(State.NeedsPermission); return }
        busy = true
        ui(State.Loading(0))
        val file = File(act.cacheDir, "update.apk")
        thread(isDaemon = true) {
            try {
                val c = URL(base + "DulidanWeb.apk").openConnection() as HttpURLConnection
                c.connectTimeout = 10000; c.readTimeout = 20000; c.instanceFollowRedirects = true
                val total = c.contentLengthLong
                var done = 0L; var lastPct = -1
                c.inputStream.use { inp -> file.outputStream().use { out ->
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        val n = inp.read(buf); if (n < 0) break
                        out.write(buf, 0, n); done += n
                        val pct = if (total > 0) (done * 100 / total).toInt() else 0
                        if (pct != lastPct) { lastPct = pct; h.post { ui(State.Loading(pct)) } }
                    }
                } }
                c.disconnect()
                h.post { install(file, j.optLong("versionCode")) }
            } catch (e: Exception) {
                busy = false
                h.post { ui(State.Failed("Download fehlgeschlagen")) }
            }
        }
    }

    /* PackageInstaller-Sitzung: ab Android 12 ohne Nachfrage, wenn die App sich schon einmal selbst installiert hat */
    private fun install(file: File, code: Long) {
        ui(State.Installing)
        thread(isDaemon = true) {
            try {
                val pi = act.packageManager.packageInstaller
                val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
                    setAppPackageName(act.packageName)
                    if (Build.VERSION.SDK_INT >= 31) setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
                    if (Build.VERSION.SDK_INT >= 34) setRequestUpdateOwnership(true)
                    setSize(file.length())
                }
                val id = pi.createSession(params)
                pi.openSession(id).use { s ->
                    s.openWrite("base.apk", 0, file.length()).use { out -> file.inputStream().use { it.copyTo(out) }; s.fsync(out) }
                    val status = PendingIntent.getBroadcast(act, 7, Intent(act, UpdateReceiver::class.java).putExtra("code", code),
                        PendingIntent.FLAG_UPDATE_CURRENT or (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0))
                    s.commit(status.intentSender)
                }
            } catch (e: Exception) {
                busy = false
                h.post { ui(State.Failed("Installation fehlgeschlagen")) }
            }
        }
    }

    /* Einmalig: „Apps installieren“ für Dulidan Web erlauben */
    fun askPermission() {
        try { act.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + act.packageName))) } catch (_: Exception) {}
    }
}

/* Rückmeldung des Installers: Bestätigung anzeigen, wenn Android sie verlangt; Fehler für den nächsten Start merken */
class UpdateReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, i: Intent) {
        when (i.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                @Suppress("DEPRECATION") val confirm = (if (Build.VERSION.SDK_INT >= 33) i.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java) else i.getParcelableExtra(Intent.EXTRA_INTENT)) ?: return
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                try { ctx.startActivity(confirm) } catch (_: Exception) {}
            }
            PackageInstaller.STATUS_SUCCESS -> {}
            PackageInstaller.STATUS_FAILURE_ABORTED -> {}   /* selbst abgebrochen: beim nächsten Check kommt das Angebot wieder */
            else -> ctx.getSharedPreferences("dw", Context.MODE_PRIVATE).edit()
                .putString("updError", "Update nicht installiert: " + (i.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE) ?: "unbekannter Fehler")).apply()
        }
    }
}
