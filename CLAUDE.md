# CLAUDE.md – Dulidan Web

Diese Datei ist die Übergabe für Claude (Terminal/Claude Code). Sie beschreibt, was das Projekt ist, wie es gebaut ist, welche Regeln gelten, wie getestet wird und **was als Nächstes geplant ist**. Zuerst ganz lesen, dann arbeiten.

---

## 1. Worum es geht

**Dulidan Web** ist ein Browser von *Dulidan Studios* (Besitzer: GitHub-Nutzer `short1106`). Optik, Farben, Easings und Schriften kommen von [dulidan-studios.com](https://dulidan-studios.com) (Repo `short1106/website-final`). Leitmotiv: **übertrieben epische Animationen** („Dream. Design. Develop. Dominate.“).

Es gibt zwei Apps, die sich Code teilen:

| Plattform | Technik | Ordner |
|---|---|---|
| Windows (Desktop) | Electron 45, Vanilla-JS (ES-Module), kein Framework | `main.js`, `main/`, `ui/`, `preload.js`, `tab-preload.js` |
| Android | Kotlin, Framework-`Activity` (kein AppCompat), Android-WebView | `android/` |
| Gemeinsam | Eigene Ergebnisseite + Rechner-Parser | `shared/` |

### Der Nutzer
- Spricht **Deutsch**, locker, tippt schnell (Tippfehler normal). **Antworten auf Deutsch**, alle UI-Texte und Code-Kommentare auf Deutsch.
- Ist kein Entwickler: erklär Schritte für ihn konkret (Links, welcher Knopf). Er testet die fertigen Builds (exe/APK), nicht den Code.
- Will Effekte „extremst cool“, schnell und kraftvoll, nicht langweilig.
- **Fragt vor Handy-Arbeit:** Neue Features zuerst am PC, **vor der Android-Umsetzung immer erst fragen**.
- Wenn er „nicht arbeiten, nur brainstormen“ sagt: wirklich nichts bauen, nur Ideen und Plan.

---

## 2. Bauen, Starten, Ausliefern

### Desktop
```bash
npm install
npm start                 # Entwicklung (Electron)
npm run dist              # Windows-Installer (NSIS) → dist/DulidanWeb-Setup.exe  (geht nur unter Windows, Linux bräuchte wine)
```
- Ausgeliefert wird ein **NSIS-Installer** (`oneClick`, pro Benutzer, Desktop- und Startmenü-Verknüpfung). Früher gab es eine portable exe; die entpackte sich in einen Temp-Ordner und hat dadurch Verknüpfungen kaputt gemacht. **Nicht zurück zu portable.**
- **Auto-Update:** `electron-updater` mit `generic`-Provider auf `https://github.com/short1106/dasdfasfasf/releases/download/latest-build` (`main/updater.js`).
  - Ablauf: prüft 8 s nach dem Start und dann alle 3 h, lädt im Hintergrund, die Titelleiste zeigt „UPDATE x · NEU STARTEN“ (`#updBtn`), sonst wird beim Beenden installiert.
  - Nur aktiv, wenn `app.isPackaged`.

### Android
```bash
cd android && ./gradlew assembleRelease      # braucht JDK 17 + Android SDK (compileSdk/targetSdk 35, minSdk 26)
```
- Abhängigkeiten: nur `androidx.webkit 1.12.1`. AGP 8.7.3, Kotlin 2.0.21, Gradle 8.11.1.
- `versionCode` kommt aus `DW_VERSION_CODE` (CI: `github.run_number`), `versionName` = `0.2.<code>`.
- **Signierung:** nur aus der Umgebung (`DW_KEYSTORE_FILE`, `DW_KEYSTORE_PASS`, optional `DW_KEY_ALIAS`, Standard `dulidan`), sonst Debug-Signatur.
- In CI: Repo-Secrets `DW_KEYSTORE` (Base64) und `DW_KEYSTORE_PASS`. Fehlen sie, erzeugt der Workflow pro Build einen Einmal-Schlüssel. Dann gehen keine Updates über die alte Version, nur Deinstallieren und neu Installieren.
- **Stand:** Der Nutzer hat eine Datei mit dem festen Schlüssel bekommen. Ob er die zwei Secrets schon eingetragen hat, ist **offen**, also nachfragen. Der Schlüssel gehört **niemals** ins Repo.
- Lokale Kompilierprüfung ohne SDK ist möglich mit `kotlinc` gegen `android-all.jar` (Robolectric) plus Stubs für `androidx.webkit` und `R`. So wurde bisher geprüft, vollständig gebaut wird nur in CI.

### CI / Releases (`.github/workflows/`)
| Workflow | Läuft bei | Ergebnis (Release, überschrieben) |
|---|---|---|
| `build-exe.yml` (windows-latest) | Push auf `ccr-5bc0fb9e-frlec2` oder `main`, außer README/zip/android | Tag `latest-build`: `DulidanWeb-Setup.exe`, `.blockmap`, `latest.yml`. Version = `0.2.<run_number>` |
| `build-apk.yml` (ubuntu) | Push mit Änderungen in `android/**`, `shared/**` oder dem Workflow selbst | Tag `android-latest`: `DulidanWeb.apk`, `android-version.json` (Version + SHA-256 des Signier-Zertifikats + `stableKey`) |

Downloads für den Nutzer:
- PC: https://github.com/short1106/dasdfasfasf/releases/download/latest-build/DulidanWeb-Setup.exe
- Handy: https://github.com/short1106/dasdfasfasf/releases/download/android-latest/DulidanWeb.apk

`dulidan-web.zip` im Repo ist ein Quellcode-Zip für den Nutzer. Bei größeren Änderungen neu packen: `zip -qr dulidan-web.zip main.js preload.js tab-preload.js package.json package-lock.json README.md .gitignore main ui shared assets`.

Bisheriger Arbeitsbranch: `ccr-5bc0fb9e-frlec2` (CI baut auch `main`).

---

## 3. Architektur Desktop

### Prozesse und Sessions
- **`main.js`** ist der Main-Prozess. Abschnitte: Protokoll · Fenster · Tabs · Enthüllung · Disko · Shortcuts · Downloads · Passwörter · Autofill · IPC · Start.
- **Fenster:** `frame: false`, die Oberfläche ist eine eigene Seite. Jeder Tab ist eine `WebContentsView`.
- **Drei Sessions:**
  - Standard-Session: die Oberfläche (`dulidan://app/ui/index.html`)
  - `persist:web`: alle Webseiten-Tabs, mit Werbeblocker
  - `dw-proxy`: im Speicher, ohne Blocker und ohne Cookies, nur für den Such-Proxy
- **Protokoll `dulidan://app/`** (privilegiert, `standard + secure + supportFetchAPI`):
  - Liefert nur `/ui`, `/assets` und `/shared` aus, mit Pfadprüfung.
  - Ist in **beiden** Sessions registriert (`serveApp(ses)`), weil die Fehlerseite und die Ergebnisseite in Tabs laufen.
  - Pfad `/api/fetch` ist der **Such-Proxy**, siehe 3.4.
- **User-Agent:** `Electron/…` und `dulidan-web/…` werden aus dem UA entfernt, sonst blockiert Google die Anmeldung („Browser nicht sicher“).

### Brücken
- **`preload.js`** (Oberfläche): schmale `contextBridge`-API `window.dulidan`. Gruppen: `tab`, `view`, `win`, `thumbs`, `pw`, `adblock`, `update`, `disco`, `wallet`, `suggest`, `weather`, `downloads`, `on`. Main akzeptiert IPC nur von `win.webContents`.
- **`tab-preload.js`** (läuft in **jeder Webseite**, sandboxed, isoliert):
  - Was es macht: Scroll-Fortschritt, **Audio-Analyse**, Passwort-Autofill/-Erfassung, Adressen/Karten-Vorschläge (Menü im geschlossenen Shadow DOM) und die Disko-Brücke.
  - Sandboxed: **kann keine weiteren Dateien `require`n**, alles muss in dieser einen Datei stehen.
  - `nodeIntegrationInSubFrames: true` nur, damit es auch in Bezahl-iframes läuft.
- **Herkunft:** Main entscheidet die Herkunft immer über `e.senderFrame` und nie über Angaben der Seite.

### Overlays über Webseiten
Eine `WebContentsView` liegt immer über dem HTML der Oberfläche. Für Panels, Palette und Orbit macht die Oberfläche deshalb ein Foto des Tabs (`capturePage`), versteckt die View und blendet das Foto unscharf darunter ein. Die Enthüllung danach läuft per Skript in der Seite (`revealScript`, isolierte Welt).

### Oberfläche `ui/`
- `index.html`, `css/{tokens,chrome,home,overlays,error}.css`
- `js/`, ES-Module:
  - `app.js`: Zentrale, Aktionen, Palette-Befehle, Tastenkürzel, Ereignisse aus Main
  - `omnibox.js`: Eingabe auflösen, Vorschläge, Energiestrahl
  - `settings.js`: Suchmaschinen (Standard **`dulidan`**), Shortcuts `yt/gh/wiki/maps/mc`, Akzente
  - `tabs.js`, `view.js`, `palette.js`, `panels.js`
  - `gl.js`: WebGL-Partikel-Logo und Nebel
  - `morph.js`: Partikel-Seitenwechsel
  - `overview.js`: **Orbit**, die 3D-Tab-Übersicht in WebGL (Spirale, Sternenfeld, Gitterboden)
  - `audio.js`: Pegel → CSS-Variablen `--au`/`--bass`, `onKick`
  - `passwords.js`, `wallet.js`, `calcpanel.js`, `boot.js`, `fx.js` (Cursor, Ripple, Burst), `sound.js`, `data.js` (Verlauf/Lesezeichen in localStorage), `util.js`, `error.js`
- **Animationsstufe:** `episch` / `normal` / `aus`. `prefers-reduced-motion` setzt den Standard auf `aus`. Federn als CSS-`linear()`-Easings (`--spring`, `--elastic`), die JS-Federn laufen zeitbasiert.

### 3.4 Eigene Ergebnisseite `shared/search/` (Desktop und Android)
- **Was der Nutzer will:** Suchen landen **nie auf der weißen Google- oder DuckDuckGo-Seite**, sondern auf `index.html?q=…&t=web|images|videos|news`.
- `engine.js` holt die Treffer über `/api/fetch?u=<url>&post=<formdata>` mit Header `x-dw: 1`. Quellen:
  - Web: DuckDuckGo-HTML (`POST html.duckduckgo.com/html/`), Ausweich auf DuckDuckGo-Lite. Anzeigen werden gefiltert, nachgeladen wird über das Formular mit dem größten `s`.
  - Bilder/Videos/News: JSON-Endpunkte `i.js`/`v.js`/`news.js` mit `vqd`-Schlüssel aus `duckduckgo.com/?q=`.
  - Wissen: Wikipedia-API (de), nur wenn der Titel zur Suche passt.
- `search.js` rendert alles mit `textContent`, nie fremdes HTML. Weitere Teile:
  - Zwischenspeicher in `sessionStorage`, damit Zurück sofort an derselben Stelle steht
  - Lightbox für Bilder
  - Rechner-Karte über `shared/calc.js`
  - Energiestrahl
- **Proxy-Regeln** (Desktop `main.js` `searchProxy`, Android `SearchProxy.kt`):
  - nur `https`
  - nur die Hosts `html.duckduckgo.com`, `lite.duckduckgo.com`, `duckduckgo.com`, `de.wikipedia.org`
  - nur mit Header `x-dw: 1`. Fremde Seiten bräuchten dafür eine CORS-Vorabanfrage, die nie beantwortet wird.
  - Antwort `{status, body}`, höchstens 4 MB
  - Bei DuckDuckGo wird der Referer gesetzt. Am Desktop geht das per `webRequest.onBeforeSendHeaders` der Proxy-Session, weil `fetch` den Header `referer` verbietet.
- Desktop-URL: `dulidan://app/shared/search/index.html`. Android-URL: `https://dulidan.search/search/index.html`, abgefangen in `shouldInterceptRequest`.
- Die Adressleiste zeigt auf der Ergebnisseite den Suchbegriff („**Dulidan** · begriff“) statt der internen Adresse.

### 3.5 Musik-Analyse (in `tab-preload.js`)
- **Abgreifen:** `captureStream()` am `<video>`/`<audio>` → `AudioContext`. Ein `ChannelSplitter` teilt das Signal in **Mitte** (L+R)/2 und **Seite** (L−R)/2, jeweils mit eigenem `AnalyserNode` (FFT 2048).
  - Die Wiedergabe der Seite bleibt unverändert, der Ausgang läuft über einen Gain auf 0.
- **Spuren pro Frame:**
  - **Bass:** 35–150 Hz der Mitte. Nur gültig, wenn der Bass im Verhältnis zum Gesamtpegel überhaupt da ist (Übersprechen sonst ignorieren).
  - **Stimme:** Energie 250–3500 Hz, nur was ausschließlich in der Mitte liegt (`sqrt(mitte² − seite²·1,15)`), multipliziert mit Tonalität (1 − spektrale Flachheit).
    - Ein-Kanal-Streams (Mitte ≡ Seite) werden erkannt.
  - **Melodie:** Seite 200–6000 Hz plus Mitte 3,5–6 kHz.
  - **Höhen** und ein **Spektrum** mit 48 log-Bändern für den Disko-Ring.
- **Pegelregelung `agc()`:** löst das alte Übersteuern.
  - Gleichmäßiger Klang landet bei etwa 0,45, nur Herausragendes geht gegen 1.
  - Gatter relativ zur Song-Spitze.
  - **Alle Glättungen sind zeitbasiert** (`fr`, `ema()`), weil die Analyse unter Last langsamer läuft.
- **Kick:** positiver Energiesprung im Bass über Mittel + 1,6·σ. Zusätzlich müssen gelten:
  - ≥ 18 % der Fluss-Spitze
  - Bass > 0,2
  - Bass > 1,2 × untere Mitten (Klicks sind breitbandig, Kicks bassig)
  - 1 s Einschwingzeit nach dem Start
  - mindestens 170 ms Abstand
- **Drop:** der erste kräftige Einsatz innerhalb von 2 s nach ≥ 1,2 s Bass-Pause, höchstens einer pro 8 s.
- **Ausgabe:**
  - An die Oberfläche geht `ipcRenderer.send('audio', [bass, melodie, stimme, gesamt, kick])`, etwa 30× pro Sekunde.
  - An die Disko-Ebene gehen pro Frame (~60/s) `dw:a`-Ereignisse.
- **Messwerte mit dem Test-Song:**
  - Stimme ohne Gesang etwa 0,00, mit Gesang etwa 0,6
  - Kicks 3/10/4/15/5, wie erwartet und ohne falsche
  - genau 1 Drop

### 3.6 Disko-Modus (Desktop, fertig)
- **Start:** Der Knopf `#btnDisco` (`.disco-btn`) erscheint, sobald im aktiven Tab Musik läuft. Alternativ `Strg+Umschalt+M` oder ein Palette-Befehl.
  - `api.disco.start(tabId)` → `discoStart()` in `main.js`.
  - Das Fenster geht ins Vollbild, die Tab-View füllt das Fenster, die Oberfläche bekommt `html-full`.
  - Beendet wird bei Esc, Tabwechsel, Navigation, Tab zu oder wenn das Vollbild endet.
- **Render-Ebene `main/disco-page.js`:**
  - Main setzt den Code per `executeJavaScriptInIsolatedWorld(1337, …)` ein. Isolierte Welt heißt: kein Zugriff durch die Seite, und die Webseite bleibt unverändert.
  - Der Tab-Preload legt das Host-Element `<dulidan-disco>` an. Die Ebene wartet darauf, weil die IPC-Nachricht später ankommen kann.
  - **Brücke nur über Text-Ereignisse** am Host:
    - Preload → Ebene: `dw:a` (Pegel, Zeit, Pause), `dw:track` (Titel/Künstler/Länge), `dw:lyrics`, `dw:off`
    - Ebene → Preload: `dw:cmd` (`ready`, `exit`)
  - **UI nur per `createElement`, kein `innerHTML`**, weil YouTube & Co. Trusted Types erzwingen.
- **WebGL (WebGL1):**
  - Hintergrund-Shader: Tunnel, Speichen, Lichtfächer, Kick-Schockwelle, Drop-Blitz, Sterne.
  - Mitte: das **echte Video als Textur** (`texImage2D(video)`) mit Zoom, Shake, Farbversatz, Glitch-Streifen beim Drop, Glühkante und Spiegelung. Bei fremden Videos ohne Freigabe oder bei reinem Audio stattdessen der **Spektrum-Ring** (Balken, Kern, Stimm-Ring).
  - 2200 Partikel (Kick-Bursts, Drop-Explosion, Melodie-Strom).
- **Stufen:** `1`/`2`/`3` für Chill (0,55), Party (1) und Eskalation (1,65).
- **Tasten:** Esc beendet, Leertaste pausiert, ←/→ spult 5 s, `+`/`−` verschiebt die Lyrics, `L` schaltet die Lyrics.
- **Lyrics:**
  - Der Tab-Preload liest Titel und Künstler aus `navigator.mediaSession.metadata`, sonst aus `document.title`.
  - Main sucht über **`main/lyrics.js`** bei **LRCLIB** (`/api/search`).
    - Der Titel wird aufgeräumt: `(Official Video)`, `ft. …`, „Künstler - Titel“, `- Topic`, `VEVO`.
    - Es werden synchronisierte LRC genommen, beim Treffer mit der passendsten Länge.
  - Anzeige Wort für Wort (Pop, Blur, große Wörter mit Verlauf, die Zeile springt auf Kicks, Glühen nach Stimme).

### Weitere Desktop-Funktionen
- **Passwörter:** `main/passwords.js`. Verschlüsselt mit `safeStorage` (unter Windows DPAPI), Ausweich AES-256-GCM mit lokalem Schlüssel.
  - Auto-Login auch zweistufig (Google/Microsoft), höchstens ein Auto-Versuch pro Minute.
  - Die Option „Automatisch anmelden“ gibt es. **Offene Frage an den Nutzer:** nur einfüllen oder auch abschicken?
- **Adressen & Karten:** `main/wallet.js` mit Luhn-Prüfung und Markenerkennung.
  - Vor dem Speichern **immer fragen**. Danach nur vorschlagen und erst nach Klick einfüllen, **nie automatisch abschicken**.
  - **Die CVC wird nie gespeichert.**
  - In iframes füllt es nur Frames derselben Herkunft.
- **Werbeblocker:** `main/adblock.js`, Ghostery mit Werbe- und Tracker-Listen samt Cache. Gezählt werden blockierte und umgeleitete Anfragen.
- **Sonstiges:** Rechtsklick-Menü (`main/contextmenu.js`), Downloads, Suchen auf der Seite, Zoom, Tabs wiederherstellen, Taschenrechner (`Strg+Umschalt+R`, auch direkt in der Adressleiste).
- Daten liegen in `%APPDATA%\dulidan-web` (`vault.json`, `wallet.json`, localStorage der Oberfläche).

---

## 4. Architektur Android (`android/app/src/main/java/com/dulidanstudios/web/`)
- **`MainActivity.kt`:**
  - Ebenen: Seiten, Startseite (`home`-WebView mit `assets/home/`), Morph-FX, untere Leiste, Vorschläge, Switcher, Menü, Rechner, Top-FX.
  - Tabs und WebViews, `PageClient` (`shouldInterceptRequest`: zuerst `SearchProxy`, dann Werbeblocker), `ChromeClient`.
  - Navigation mit Partikel-Morph, Menü-Aktionen, Widget-Intents, Zurück-Logik, Updates.
  - Der UA ist ohne `; wv` und ohne `Version/x`. `X-Requested-With` ist abgeschaltet.
- **Die JS-Brücke `Dulidan` gibt es nur auf der lokalen Startseite**, nie in fremden Seiten. Methoden: `go`, `haptic`, `ready`, `calc`, `calcValue`.
- **Weitere Dateien:**
  - `Ui.kt`: Farben, Akzente, Schriften, Feder-Interpolator, Haptik, `pressable`
  - `Store.kt`: SharedPreferences, Standard-Suchmaschine `dulidan` mit einmaliger Umstellung
  - `Search.kt`, `AdBlock.kt` (StevenBlack-Hosts)
  - `FxView.kt`: Burst/Shatter/Morph auf Canvas
  - `BottomBar.kt`, `Switcher.kt` (3D-Kartenstapel)
  - `Panels.kt`: Vorschläge, Toast, Menü-Sheet mit 12 Kacheln, Boot, Update-Pille
  - `Calc.kt`: derselbe Parser wie `shared/calc.js`, dazu das Rechner-Panel, das von oben einfällt
  - `SearchWidget.kt`: Startbildschirm-Widget (Suche, Sprachsuche, Rechner)
  - `SearchProxy.kt`: Ergebnisseite und Proxy unter `https://dulidan.search/`
  - `Updater.kt`: liest `android-version.json`, lädt per DownloadManager, öffnet den Installer. Passt der Schlüssel nicht, sagt die App ehrlich „einmal neu installieren“.
- **Assets:** `assets/home/` (Startseite, klassische Skripte, Logo als data-URL), `assets/fonts/`. Dazu `shared/` über `sourceSets["main"].assets.srcDir("../../shared")`, also `assets/search/…` und `assets/calc.js`.
- **Auf Android fehlen noch:** Disko-Modus, Musik-Analyse, Passwörter/Autofill. Vorher fragen.

---

## 5. Regeln und Konventionen

- **Code-Stil:** Vanilla-JS, keine Frameworks und keine neuen Abhängigkeiten ohne guten Grund.
  - Jede Datei beginnt mit einem Kopfkommentar wie `/* Dulidan Web · datei.js – Zweck · Aufbau: … */`.
  - Kommentare sind kurz, auf Deutsch, und erklären das *Warum*.
- **Design-Tokens** (aus der Website):
  - Hintergrund `#07060b`
  - Akzente `--vio #8122b5`, `--mag #c020b8`, `--pink #ff7ae6`
  - Text `#efeaf7`, gedämpft `#a49cb6`, dimm `#8a83a0`
  - Schriften Space Grotesk und JetBrains Mono, lokal als woff2
- **Fremdes HTML nie per `innerHTML`.** In Seiten eingesetzter Code wegen Trusted Types grundsätzlich mit `createElement`.
- **Sicherheit:**
  - Keine Signierschlüssel, Passwörter oder Tokens ins Repo, das Repo ist öffentlich. `*.jks` ist ignoriert.
  - Proxy-Whitelist nicht aufweichen.
  - Main vertraut nie Angaben der Seite über ihre Herkunft.
  - Wallet: nie automatisch abschicken, CVC nie speichern.
- **Tests:** Keine echten Formulare an echte Dienste abschicken (keine echten Google-Logins), sondern lokale Nachbauten benutzen.
- **Git:** Commit-Nachrichten auf Deutsch. Für jeden Push auf den Branch baut CI exe und APK, und das Auto-Update verteilt die exe an den Nutzer. Also nur gesund pushen.

---

## 6. Testen (`tests/`)
- **E2E:** Playwright `_electron` unter `xvfb-run`. Für WebGL ohne GPU braucht es `--enable-unsafe-swiftshader`, für Medien ohne Klick `--autoplay-policy=no-user-gesture-required`.
- **Testserver starten:** `tests/serve.sh`. Ports: 8765–8767 Testseiten, 8799 DuckDuckGo/Wikipedia-Nachbau, 8798 Test-Song und LRCLIB-Nachbau.
  - Der Test-Song wird beim ersten Start mit `tests/fixtures/disco/make-track.py` erzeugt (numpy + ffmpeg).
- **Ausführen:** aus `tests/out/` heraus, weil manche Screenshot-Pfade relativ sind.
  ```bash
  mkdir -p tests/out/shots{,2,3,4,5,6,7} && cd tests/out
  xvfb-run -a node ../e2e/clearsess.js   # wiederhergestellte Tabs aus vorigen Läufen löschen
  xvfb-run -a node ../e2e/test.js        # Grundfunktionen
  ```
- **Was die Tests prüfen:**
  - `test.js`/`test2.js`/`test3.js`: UI, Tabs, Orbit, Musik, Suche/Zoom/Wiederherstellen
  - `test4.js`: Adressen und Karten inklusive Stripe-iframe
  - `gtest.js`: zweistufiger Google-artiger Login (lokal)
  - `adtest.js`, `looptest.js`
  - `calcui.js`, `updui.js`
  - `searchtest.js`: Ergebnisseite, braucht `DW_PROXY_BASE`
  - `mobilesearch.js`: Ergebnisseite im Handy-Format
  - `discotest.js video.html|audio.html`: Disko inklusive Esc, Drops und Screenshots
  - `anatest.js`: Analyse-Werte je Song-Abschnitt
  - `hometest*.js`: Android-Startseite im Browser
  - `calctest.mjs`: Parser-Einheitstests
- **Test-Haken (nur über Umgebungsvariablen aktiv):**
  - `DW_PROXY_BASE=http://127.0.0.1:8799`: der Such-Proxy fragt den Nachbau
  - `DW_LYRICS_BASE=http://127.0.0.1:8798`: LRCLIB-Nachbau
  - `DW_DEBUG=1`: Proxy-Fehler loggen
- **Stolpersteine:**
  - Die Tests nutzen das echte Profil (`~/.config/dulidan-web`). `test4.js` erwartet ein leeres `wallet.json`, `gtest.js` ein noch nicht gespeichertes Passwort.
  - Playwright-Tasten lösen kein `before-input-event` aus. Dafür gibt es einen DOM-Keydown-Ausweich in der Oberfläche.
  - `page.screenshot` zeigt nur die Oberfläche. Tab-Inhalte holt man mit `view.webContents.capturePage()`.
  - Chromiums History-Intervention: Zurück braucht in Tests `userGesture`.
- **Android:** Im Container ging nur die Kompilierprüfung und der Browser-Test der Startseite. Echtes Gerät oder Emulator gab es nie.

---

## 7. NÄCHSTE AUFGABEN (vom Nutzer so abgestimmt)

### 7.1 Lyrics-Timing reparieren (Desktop, höchste Priorität)
**Problem laut Nutzer:** Der Anfang von Musikvideos wird komplett ignoriert, die Lyrics fangen zu früh an.

**Ursache im Code:** `autoAlign()` in `main/disco-page.js` probiert nur die Versätze `0` und `Videolänge − LRC-Länge` aus. Es greift erst nach 0,5 s erkannter Stimme und auch nur, wenn der Fehler unter 8 s liegt. Sonst bleibt der Versatz 0, und der Text startet ab Sekunde 0.

**Abgestimmte Lösung (in dieser Reihenfolge):**

1. **Idee C, YouTube-Untertitel zuerst (wenn vorhanden):**
   - Viele offizielle Musikvideos haben Lyrics-Untertitel, die exakt auf *dieses* Video getimt sind, Intro inklusive.
   - Wo es geht:
     - Im Tab-Preload ist der DOM der Seite lesbar, Seitenvariablen aber nicht.
     - Die Caption-Liste steckt im Player-Response, also in `ytInitialPlayerResponse` bzw. im `<script>`-Inhalt der Seite, oder in der `/youtubei/v1/player`-Antwort. Dort gibt es `captions.playerCaptionsTracklistRenderer.captionTracks[]` mit `baseUrl`, `languageCode` und `kind` (`asr` = automatisch).
     - Bei SPA-Navigation (nächstes Video ohne Neuladen) muss die Liste neu ermittelt werden. Video-ID aus `?v=`.
   - Abruf: `baseUrl + '&fmt=json3'` (gleiche Herkunft wie die Seite), Format `events[].tStartMs/dDurationMs/segs[].utf8`. Alternativ über Main mit Host-Whitelist.
   - Bevorzugen:
     1. manuelle Tracks (kein `asr`) in Sprache des Songs oder `de`/`en`
     2. danach automatische Tracks nur als Notlösung
   - Ins gleiche Format wie LRC umwandeln: `{lines: [{t, text}], source: 'youtube'}`. Bei dieser Quelle ist **kein Versatz nötig**.
2. **Idee B, wenn es keine Untertitel gibt: LRCLIB plus Mustervergleich mit der Stimme:**
   - Gesangseinsätze laufend erkennen (Stimm-Spur steigt nach Ruhe an) und mit Medienzeit sammeln.
   - Den Versatz suchen, bei dem möglichst viele LRC-Zeilenstarts auf Gesangseinsätze fallen. Zusätzlich sollten Textpausen (leere Zeilen oder große Lücken) auf Stellen ohne Stimme fallen.
   - Suchfenster etwa `[−5 s, (Videolänge − LRC-Länge) + 5 s]`.
   - Konfidenz: erst nach 3–4 passenden Zeilen festlegen, danach weich nachführen.
   - Bis zur Festlegung: Lyrics **ausblenden** und „♪ warte auf Gesang …“ pulsieren lassen (Idee A als Übergang).
3. **Idee D, Rettung:** eine Taste „Sync jetzt“, die die aktuelle Zeile auf jetzt legt. Den Versatz **pro Video-ID merken** (lokal speichern), damit er beim nächsten Mal sofort stimmt.
4. Idee E (Whisper/KI-Spracherkennung im Browser) bewusst **nicht**: zu schwer, Gesang wird schlecht erkannt.

### 7.2 Neuer Modus „Lyric Motion“ (Desktop, nach 7.1)
Der Nutzer findet die Idee „geil“: ein Modus **ohne Video**, nur Motion-Art-Lyrics. Schnell, kraftvoll, mit dem Hintergrund verzahnt, **im Stil von Orbit** (3D-Raum, Sternenfeld, Gitterboden, fliegende Kamera; Technik und Look aus `ui/js/overview.js` übernehmen).

**Wechsel:** `V` schaltet live zwischen Video-Modus und Lyric Motion. Welcher Modus beim Start kommt, hat der Nutzer noch nicht entschieden, also fragen.

**Wie die Wörter reinkommen**, gewählt nach Energie und Abschnitt:
- **Slam:** Ein Wort knallt riesig aus der Tiefe auf den Screen. Beim Aufprall gibt es eine Schockwelle über den Gitterboden, Staub und einen Kamerastoß.
- **Fly-Through:** Die Wörter stehen im Raum, die Kamera fliegt durch sie hindurch.
- **Shatter-Morph:** Ein Wort zerfällt auf dem Beat in Partikel, die zum nächsten Wort zusammenfliegen. Die Technik dafür gibt es in `ui/js/morph.js`: Text auf eine Canvas zeichnen und daraus die Partikelziele abtasten.
- **Glitch-Type:** Buchstaben scramblen rein, mit Farbversatz.
- **Kinetic Stack:** gedrehte Wörter stapeln sich, mit Groß-Klein-Kontrast.
- **Echo-Trails:** leuchtende Nachbilder.
- **Orbit-Ring:** Wörter kreisen wie die Tab-Karten.

**Steuerung durch die Musik:**
- **Bass:** Kamera-Punch, FOV-Stoß, Bodenwellen unter dem Wort
- **Stimme:** Größe und Leuchten des aktuellen Worts
- **Melodie:** Farbfluss in Nebel und Lichtfächern
- **Drop:** Kamera-Rolle, alles explodiert, kurzer Farb-Invert
- **Refrain:** Zeilen, die in den Lyrics mehrfach vorkommen, sind der Refrain und bekommen automatisch die krassesten Effekte (Slam, Shatter). In der Strophe eher elegante Fly-ins.
- **Wort-Timing:** Statt die Wörter gleichmäßig über die Zeile zu verteilen, ploppt jedes Wort auf einen echten Impuls der Stimm-Spur, also auf die Silben.

**Technik:** WebGL in der Disko-Ebene (`main/disco-page.js` oder ein eigenes Modul, das genauso eingesetzt wird). Text wird per Canvas 2D in einen Textur-Atlas gerendert, dazu Partikel aus Text-Pixeln. Der Tab-Preload liefert schon alle Spuren, Kicks, Drops und Medienzeit.

### 7.3 Danach (immer erst fragen)
- Disko-Modus und Lyric Motion für **Android**: im Tab per `evaluateJavascript` einsetzen, Knopf in der unteren Leiste, Querformat.
- Android-Secrets einrichten lassen (siehe 2.), danach ein letztes Mal neu installieren.
- Offene Frage Passwörter: nur einfüllen statt automatisch anmelden?
- Weitere Ideen, die schon vorgeschlagen wurden und noch nicht entschieden sind:
  - Sync zwischen PC und Handy (Ende-zu-Ende verschlüsselt)
  - Passwörter und Autofill fürs Handy (mit Fingerabdruck)
  - Ergebnisseite: Wetter-Karte, Währungs- und Einheiten-Umrechner, Live-Vorschläge
  - Lesemodus, Inkognito-Tabs

---

## 8. Bekannte Grenzen
- **DRM** (Netflix, Spotify Web): Weder Audio-Analyse noch Video-Textur sind möglich.
- DuckDuckGo kann bei vielen Suchen bremsen. Die Ergebnisseite zeigt dann „Zu viele Suchen auf einmal“ mit „Nochmal versuchen“.
- Die exe ist nicht kostenpflichtig signiert, deshalb erscheint beim ersten Start die SmartScreen-Warnung („Weitere Informationen → Trotzdem ausführen“).
- Ungetestet: Windows selbst (nur CI-Builds), echte Android-Geräte, echte YouTube/LRCLIB/DuckDuckGo-Antworten (der Container hatte keinen Zugriff) und DPAPI.
