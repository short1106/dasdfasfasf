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
  - `overview.js`: **Orbit**, die 3D-Tab-Übersicht in WebGL mit drei Stilen (Taste `S` oder Chip oben, gemerkt in `dw_orbit_style`): **Spirale** (Flug, Gitterboden), **Karussell** (Ring um einen Mittelpunkt, Neon-Kreise mit drehenden Speichen, hintere Karten blenden aus), **Coverflow** (Mitte frontal, Seiten schräg, Spiegelbild im Boden bei y = −1,12). `place(stil, i)` + `camOf(stil)`, Wechsel als 0,9-s-Morph zwischen altem und neuem Platz. Dazu zwei eigene Designs: **Galaxie** (Tabs als Kugeln mit der Seite als Oberfläche, Shader `PL_*` als Billboard-Kugel mit Licht von der Dulidan-Sonne, Umlaufbahnen als Linien, Bahnen stehen beim Zoomen still, beim Hineinzoomen blendet der Planet in die Karte über) und **Wabe** (Hologramm-Sechsecke: `uHex` im Karten-Shader, Scanlinien, Flackern, Farbversatz, Lupe um den Mauszeiger, Sechseck-Wand mit Scan-Strahl). Test `tests/e2e/orbitstyles.js`
  - `audio.js`: Pegel → CSS-Variablen `--au`/`--bass`, `onKick`
  - `passwords.js`, `wallet.js`, `calcpanel.js`, `boot.js`, `fx.js` (Cursor, Ripple, Burst), `sound.js`, `data.js` (Verlauf/Lesezeichen in localStorage), `util.js`, `error.js`
- **Design „Japan 和“** (Einstellung `theme`, Einstellungen → Design, Palette): `html[data-theme=japan]` in `css/japan.css`, `js/japan.js` (Kirschblüten-Canvas über der Oberfläche, rote Sonne mit Wolken, Senkrecht-Schrift, Untertitel, japanische Bänder). Farben über `JAPAN` in `settings.js` (überschreibt den Akzent, also auch WebGL-Logo und Orbit), Mitte wechselt auf das Japan-Logo und beim Ausschalten zurück (`centerBefore`). Schriften von Windows: Yu Mincho/Yu Gothic. Test `tests/e2e/japan.js`.
- **Animationsstufe:** `episch` / `normal` / `aus`. `prefers-reduced-motion` setzt den Standard auf `aus`. Federn als CSS-`linear()`-Easings (`--spring`, `--elastic`), die JS-Federn laufen zeitbasiert.

### 3.4 Eigene Ergebnisseite `shared/search/` (Desktop und Android)
- **Was der Nutzer will:** Suchen landen **nie auf der weißen Google- oder DuckDuckGo-Seite**, sondern auf `index.html?q=…&t=web|images|videos|news`.
- `engine.js` holt die Treffer über `/api/fetch?u=<url>&post=<formdata>` mit Header `x-dw: 1`. Quellen:
  - Web: DuckDuckGo-HTML (`POST html.duckduckgo.com/html/`), Ausweich auf DuckDuckGo-Lite. Anzeigen werden gefiltert, nachgeladen wird über das Formular mit dem größten `s`.
  - Bilder/Videos/News: JSON-Endpunkte `i.js`/`v.js`/`news.js` mit `vqd`-Schlüssel aus `duckduckgo.com/?q=`.
  - Wissen: Wikipedia-API (de), nur wenn der Titel zur Suche passt.
  - **Sofort-Antworten `answers.js`** (`detect(q)` → Karte oder `null`, Fehler bleiben still): Wetter (Open-Meteo Forecast + Geocoding, ohne Ort IP-Standort), Währung (Frankfurter `api.frankfurter.dev/v1`, EZB, plus 30-Tage-Verlauf), Einheiten (lokal), Fußball (OpenLigaDB: `getmatchdata/bl1|bl2|bl3`, `getbltable/<liga>/<saison>`, `getmatchesbyteam/<filter>/4/3`; Live-Spiele → Karte lädt jede Minute neu), Formel 1 (Jolpica `ergast/f1/current/driverstandings/` und `/races/`).
    - Liga-Karte: Schalter 1./2./3. Liga und Ansicht „Spieltag & Tabelle“ ↔ „Prognose“ (`seq` verhindert, dass alte Antworten neue überschreiben). Prognose: Poisson-Modell (Angriff/Abwehr aus Toren/Gegentoren je Spiel, früh in der Saison zum Mittel gezogen, Heimvorteil 1,12), Tipp = wahrscheinlichstes Ergebnis plus 1/X/2; Rest der Saison (`getmatchdata/<liga>/<saison>`) 5.000-mal simuliert in Häppchen → Ø Punkte, Meister, CL/Aufstieg, Abstieg (Relegation zählt als Abstieg).
    - Die Seitenspalte am Desktop ist sticky und scrollt deshalb selbst (`max-height`), sonst wären hohe Karten unten abgeschnitten.
    - Vereine nur über eindeutige Namen (`bvb`, `fc bayern`, `msv duisburg` …), Städte allein bleiben normale Suchen.
    - Formate aus der Doku nachgebaut (Container ohne Zugriff), Nachbau in `tests/fixtures/search-server.js`, Test `tests/e2e/answers.js`. **Gegen die echten APIs ungetestet.**
- `search.js` rendert alles mit `textContent`, nie fremdes HTML. Weitere Teile:
  - Zwischenspeicher in `sessionStorage`, damit Zurück sofort an derselben Stelle steht
  - Lightbox für Bilder
  - Rechner-Karte über `shared/calc.js`
  - Energiestrahl
- **Proxy-Regeln** (Desktop `main.js` `searchProxy`, Android `SearchProxy.kt`):
  - nur `https`
  - nur die Hosts `html.duckduckgo.com`, `lite.duckduckgo.com`, `duckduckgo.com`, `de.wikipedia.org` (plus Maps/Übersetzer, siehe 3.8/3.9, und für die Sofort-Antworten `api.open-meteo.com`, `geocoding-api.open-meteo.com`, `api.frankfurter.dev`, `api.openligadb.de`, `api.jolpi.ca`, Desktop und Android)
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
- **Tasten:** Esc beendet, Leertaste pausiert, ←/→ spult 5 s, `+`/`−` verschiebt die Lyrics, `L` schaltet die Lyrics, `V` Video ↔ Lyric Motion, `S` Sync jetzt.
- **Lyrics-Quellen (in dieser Reihenfolge, `tab-preload.js` `loadLyrics`):**
  1. **YouTube-Untertitel** (`ytLyrics`): holt `/watch?v=<id>` (gleiche Herkunft), liest `captionTracks` aus dem Seitentext (`jsonArrayAfter`), nimmt **nur manuelle** Tracks (kein `asr`), lädt `baseUrl&fmt=json3` → Zeilen mit Wortzeiten (`w`), Lücken als leere Zeilen. `exact: true`, kein Abgleich. Neu ermittelt bei SPA-Wechsel (Video-ID).
  2. Ist die json3-Datei gesperrt: **Live-Untertitel** aus dem Player (`liveStart`, MutationObserver auf die Caption-Fenster), `live: true`.
  3. **LRCLIB** über Main (`main/lyrics.js`): Titel aufräumen (`(Official Video)`, `ft. …`, „Künstler - Titel“, `- Topic`, `VEVO`), synchronisierte LRC mit der passendsten Länge.
- **Abgleich am Gesang (nur LRCLIB, `disco-page.js`):**
  - `trackVoice`: Stimm-Einsätze (nach ≥ 0,3 s Ruhe) und ein 0,1-s-Raster „Stimme da / gehört“.
  - `scoreAt(c)`: +1 je Zeilenstart mit Einsatz in [−0,7; +0,5] s, −0,35 ohne, −1 je Textpause mit viel Stimme. Gesucht in `[−5, Videolänge − LRC-Länge + 6]`.
  - Festlegen (`L`) erst bei ≥ 3 Zeilen, Score ≥ 2,5 und deutlichem Abstand zum nächstbesten Versatz, danach weich nachführen.
  - Vorher: Gate. Lyrics versteckt, „♪ WARTE AUF GESANG …“ pulsiert. Stabiler Gesang (> 0,6 s) legt die erste Zeile vorläufig auf den letzten Einsatz.
  - **Sync pro Video:** `S` legt die nächstliegende Zeile auf jetzt, `+`/`−` ebenso. Gespeichert über `dw:cmd sync <v>` → IPC `lyrics:offset:set` → `userData/lyrics-sync.json`, Schlüssel `yt:<id>` oder `titel|künstler`. Ein gemerkter Versatz gilt sofort (`manual`).
  - Debug: `H.dataset.sync` (Versatz, L/G/X, Modus, Stimme, Einsätze) und `H.dataset.line`.
- **Anzeige Video-Modus:** Wort für Wort auf Silben-Impulse der Stimme (oder Wortzeit), Pop, Blur, große Wörter mit Verlauf, Zeile springt auf Kicks. HUD mit BPM, Quelle, Modus, Sync.
- **Lyric Motion `main/disco-motion.js`** (wird vor `disco-page.js` in dieselbe Welt gesetzt, `window.__dwMotion`):
  - WebGL1-3D wie Orbit: Himmel, Gitterboden mit Wellen, Sternentunnel, 3200 Partikel, Wörter als Canvas-Texturen.
  - Stile: Refrain (mehrfach vorkommende Zeilen) → Slam/Shatter, Energie > 0,55 → Glitch/Stack, sonst Fly/Ring.
  - Bass → Kamera-Punch, Stimme → Leuchten, Melodie → Farbfluss, Drop → Kamera-Rolle, Explosion, kurzer Invert.
  - Farben über `hsv()` auf Dulidan-Töne gefaltet (Blauviolett bis Pink).
  - Ohne Lyrics laufen Titel und „DULIDAN DISCO“ (`idleMotion`).
  - Startmodus ist immer Lyric Motion (vom Nutzer entschieden), `V` wechselt zum Video-Modus.
- **Test:** `tests/e2e/discosync.js` mit `intro.html` (`phrases.webm`, 6-s-Intro, LRC ohne Intro → erwartet +6 s, Sync-Datei 6).

### 3.9 Dulidan Maps `shared/maps/` (Desktop)
- **Aufruf:** `maps …` in der Adressleiste. Der Shortcut zeigt jetzt auf Dulidan Maps statt Google Maps, ebenso die Startseiten-Karte „Dulidan Maps“, Palette und Menü. Die Adressleiste zeigt „Maps · ort“.
- **Karte:** MapLibre GL **5.24** (bewusst die 5er-Reihe, Version 6 ist neu). Main liefert sie unter `/vendor/maplibre/` aus.
  - Vektorkacheln und Schriften kommen von **OpenFreeMap** (`tiles.openfreemap.org/planet`, OpenMapTiles-Schema, frei, ohne Schlüssel). Die Konfiguration holt die Seite über `/api/mapconfig`, für Tests per `DW_MAP_BASE` umgebogen.
  - Die Attribution „© OpenStreetMap-Mitwirkende · OpenFreeMap“ ist Pflicht und muss bleiben.
- **Stil `style.js`:** Nachtkarte im Dulidan-Look.
  - Straßen leuchten nach Klasse (motorway pink, primary magenta …), Wasser violett.
  - 3D-Gebäude (`fill-extrusion`, je höher, desto pinker), Ortsnamen auf Deutsch (`name:de`).
  - Mit `@maplibre/maplibre-gl-style-spec` als gültig geprüft.
- **Dienste über den App-Proxy (Whitelist, eigene App-Kennung als User-Agent):**
  - Suche und Vorschläge beim Tippen: **Photon** (`photon.komoot.io`, erlaubt Autocomplete, anders als Nominatim)
  - Rückwärtssuche: Photon `/reverse`
  - Routen: **routing.openstreetmap.de** (`routed-car|bike|foot`, OSRM-Format, Schritte → deutsche Hinweise in `say()`)
  - Standort ungefähr über IP: `get.geojs.io`. Electron hat ohne Google-Schlüssel kein GPS.
- **Effekte:**
  - Intro-Flug zum Standort mit Neigung.
  - D-Pin fällt elastisch ein, der Standort pulsiert.
  - Die Route zeichnet sich als Energielinie ein (`line-gradient` mit `line-progress`, Stützstellen streng aufsteigend), danach läuft ein Puls die Linie entlang.
- **Bedienung:** Rechtsklick „Was ist hier? / Route hierher / Route von hier“, 3D an/aus, Kompass, `/` fokussiert die Suche.
- **Verkehr `shared/maps/logistics.js`** (Knopf `#traffic`, Taste `T`, URL `?layer=verkehr`):
  - **Nicht live**, Wunsch des Nutzers: beliebte Routen mit ungefährer Menge. Daten fest im Modul: ~90 Flughäfen, ~120 Flugrouten (Flüge/Tag), 16 Seewege als Wegpunkte (Schiffe/Tag, Längen > 180 laufen über die Datumsgrenze), 26 Schnellzug-Strecken (Züge/Tag). Zahlen sind gerundete Richtwerte.
  - Flüge als Großkreise (`greatCircle`, Längen entfaltet), Seewege/Bahn fein unterteilt (`densify`).
  - Fahrzeuge: Anzahl nach Menge, halb hin, halb zurück. Ein GeoJSON-Punkt-Source wird ~30×/s neu gesetzt. Icons per Canvas (`map.addImage`), gedreht nach Mercator-Kurs, Flugzeuge mit Leuchtspur (`line-gradient`).
  - Farben: Flug pink, Schiff cyan `#7af3ff`, Bahn bernstein `#ffc27a`. Linienbreite und Helligkeit nach Menge, Hover hebt hervor, Klick → Toast mit Route und Menge.
  - Beim Öffnen Globus (`setProjection({type:'globe'})`) und Flug nach außen, beim Schließen zurück zu Mercator und zur alten Ansicht.
  - Test: `tests/e2e/traffic.js` (gleiche Server wie `maps.js`).
- **News `shared/maps/news.js`** (Knopf `#newsBtn`, Taste `N`, URL `?layer=news`, schließt den Verkehrs-Modus und umgekehrt):
  - Quelle **GDELT DOC 2.0** (`api.gdeltproject.org/api/v2/doc/doc`, frei, ohne Schlüssel, alle 15 Minuten neu), in beiden Proxy-Whitelists.
  - Länder als Punkte aus einer eigenen Tabelle (~120 Länder: ISO, GDELT-Name wie `unitedstates`, deutscher Name, Mittelpunkt), weil die OpenMapTiles-Kacheln keine Länderflächen haben. Ring pulsiert per `setPaintProperty` (~20/s).
  - **Blickwinkel** (Wunsch des Nutzers): Standard „Über das Land · Deutsch“ = `"<deutscher Name>" sourcelang:german` (Ausweich Google News `hl=de&gl=DE` mit Suche nach dem Land); Umschalter „Presse aus dem Land“ = `sourcecountry:<name>` in Originalsprache (Ausweich Google-News-Titelseite des Landes).
  - Thema → `mode=timelinesourcecountry&timespan=3d`, Summe je Land → Punktgröße/Helligkeit und Top-6-Liste. Land → `mode=artlist&query=[thema] sourcecountry:<name>&sort=datedesc&timespan=2d`, doppelte Überschriften raus, Link `target=_blank` (Desktop neuer Tab), fremdsprachige Titel mit „DE“-Knopf zum Übersetzer.
  - GDELT erlaubt etwa eine Anfrage pro 5 s: Warteschlange mit 5,5 s Abstand plus 10 Minuten Zwischenspeicher, Text-Antwort statt JSON → „Zu viele Anfragen“.
  - Beim Nutzer kam anfangs immer „GDELT nicht erreichbar“: der Proxy brach nach 9 s ab. Jetzt 25 s für `api.gdeltproject.org` (Desktop `SLOW_HOSTS`, Android `readTimeout`). Leere Antwort = keine Treffer, 429/599/5xx → ein neuer Versuch, Meldung nennt den Grund.
  - **Ausweich Google-News-RSS** (`news.google.com/rss?hl=&gl=&ceid=`, mit Thema `/rss/search?q=`), Host in beiden Whitelists: kommt von GDELT nichts, zeigt das Land die Google-Schlagzeilen (ohne Bild, Quelle aus `<source>`). Die Themen-Karte (Länder nach Berichtsmenge) gibt es nur über GDELT.
  - Test `tests/e2e/mapnews.js` (GDELT-Nachbau in `search-server.js`). **Gegen das echte GDELT ungetestet.**
- **Grenzen:** kein Street View, keine Bewertungen, kein Live-Verkehr und keine ÖPNV-Fahrpläne. Diese Daten gehören Google.
- **Test:** `tests/e2e/maps.js` gegen `tests/fixtures/maps/tileserver.py` (echte MVT-Kacheln prozedural, braucht `pip install mapbox-vector-tile shapely`, Port 8796) und den Photon/OSRM/geojs-Nachbau in `search-server.js`.
- **Android:** gleiche Seite unter `https://dulidan.search/maps/index.html` (siehe 4.). Dazu dort echtes GPS: `onGeolocationPermissionsShowPrompt` erlaubt den Standort **nur** für den Host `dulidan.search`, Laufzeit-Erlaubnis erst beim Antippen von „Mein Standort“. `maps.js` nimmt GPS beim Start nur, wenn die Erlaubnis schon da ist (`permissions.query`), sonst IP. Am Desktop verweigert Electron Geolocation sofort → IP.

### 3.8 Übersetzer `shared/translate/` (Desktop und Android)
- **Aufruf:**
  - `tr text` in der Adressleiste (Shortcut in `settings.js`)
  - Palette und Menü „Übersetzer“
  - Rechtsklick auf markierten Text → „Übersetzen“
- **Seite:** `dulidan://app/shared/translate/index.html?q=&from=&to=`. Die Adressleiste zeigt „Übersetzer · text“.
- **Sprachen:** Auto (Erkennung über Schrift, Sonderzeichen und Stoppwörter), DE, EN, JA, ES, FR, TR.
- **Lokal (privat, offline):** Mozilla Bergamot (`@browsermt/bergamot-translator`).
  - Die Engine läuft als Worker **in der Seite**. Main liefert das Paket unter `/vendor/bergamot/` aus.
  - Der Node-Modus des Pakets ist in 0.4.9 kaputt: der Worker nutzt `require`, das Paket ist aber `type: module`.
- **Sprachpakete:** `main/translate-models.js` lädt sie aus `storage.googleapis.com/bergamot-models-sandbox/0.3.3` (Registry plus `<paar>/<datei>`).
  - Prüft die SHA-256-Summe und legt sie in `userData/translate-models/` ab.
  - Abruf über `/api/model?f=` mit `x-dw: 1`. `f=__installed` listet die geladenen Paare.
  - Lokal gibt es u. a. de/en/es/fr. Alles, was nicht direkt geht, läuft über Englisch als Zwischensprache.
- **Online:** **Kein lokales Modell für Japanisch und Türkisch.** Diese gehen über MyMemory (`api.mymemory.translated.net`, in der Proxy-Whitelist).
  - Gestückelt auf 450 Zeichen, mit Tageslimit-Meldung.
  - Schlägt lokal etwas fehl (kein Netz beim ersten Laden o. Ä.), wird ebenfalls online versucht.
- **Animation:**
  1. Die Ausgabe zeigt zuerst die Wörter der Eingabe.
  2. Dann scrambelt jedes Wort in einer Welle von links nach rechts zum Ziel. Bei Japanisch mit Katakana-Glyphen, sonst Latin.
  3. Gleiche Wörter flackern nur kurz, beim Landen gibt es Pop und Funken.
- **Weitere Funktionen:** Tauschen-Knopf, Kopieren, Vorlesen (`speechSynthesis`), Energiestrahl am Rand während der Arbeit.
- **Test-Haken:** `DW_MODEL_BASE` (Modelle von einem lokalen Server) und `DW_PROXY_BASE` (MyMemory-Nachbau in `tests/fixtures/search-server.js`).
- **Android:** `https://dulidan.search/translate/index.html`, Sprachpakete über `Models.kt` (gleiche Quelle, SHA-256-Prüfung, `filesDir/translate-models/`). Ob Dedicated Worker + WASM in der Android-WebView über `shouldInterceptRequest` laden, ist auf echtem Gerät ungetestet; scheitert die lokale Engine, springt die Seite auf MyMemory um.

### 3.7 Objekt in der Mitte (Desktop und Android)
- **`shared/shapes.js`** ist ein *klassisches* Skript, kein Modul, weil die Android-Startseite über `file://` läuft. Es setzt `window.DW_SHAPES`:
  - `list`
  - `gen(key, n, logoImg)` → `{P, L}`, also Zielpunkte in [-1,1]² und Helligkeit
  - `spin(key)`, `diff(key)`, `has(key)`
- **Formen:** `d`, `japan`, `blume`, `galaxie`, `herz`, `planet`, `atom`, `stern`, `schmetterling`.
  - `d` und `japan` werden aus einer Canvas abgetastet. Das Japan-Logo besteht aus dem D, „ドゥリダン“ und „スタジオ“ mit Glitzer und Herzen. Die Schrift kommt vom System: Yu Gothic/Meiryo unter Windows, Noto CJK unter Android.
  - Alle anderen Formen sind Mathe.
- **Wechsel:** Die Partikel haben zwei Zielpositionen (`aP`/`aQ`). `uMorph` geht in 1,6 s von 0 auf 1, dabei sprengen und wirbeln die Partikel. Danach wird das Ziel zur Ausgangsform.
  - Eigenbewegung über `uSpinA/B` und `uDiffA/B`. „Differentiell“ heißt: innen schneller, für die Galaxie.
- **Desktop** (`ui/js/gl.js`):
  - Einstellung `center` im Panel „Objekt in der Mitte“, dazu Palette-Befehle „Objekt in der Mitte: …“.
  - Doppelklick auf das Objekt wechselt weiter.
- **Android** (`assets/home/home.js`):
  - `dwShape(key)` von nativ; Store-Feld `center`.
  - Im Menü der Abschnitt „OBJEKT IN DER MITTE“.
  - Doppeltipp auf das Objekt → Brücke `Dulidan.shape(key)`.

### Weitere Desktop-Funktionen
- **Inkognito-Tabs:** `tab:create({incognito})`, eigene Partition `dw-incognito` ohne `persist:` (nur im Speicher), eingerichtet wie `persist:web` über `prepareWebSession()`.
  - Kein Verlauf (`addHistory` übersprungen), nicht in `dw_session`, keine Passwort-/Wallet-Angebote, kein Lyrics-Sync. Lesen gespeicherter Passwörter bleibt erlaubt.
  - Letzter Inkognito-Tab zu → `wipeIncognito()` (Storage, Cache, Auth, DNS) → UI `incognito-wiped` mit Glitch-Wisch.
  - Werbeblocker: Ghostery meldet seine IPC-Handler global an, kann also nur eine Session direkt bedienen. Für Inkognito hängt `adblock.attach()` nur die Netzwerk-Filter (`onBeforeRequest`/`onHeadersReceived`) an, ohne kosmetische Filter.
  - UI: `body.inco` (kühle Akzente), Tab `.inco` mit Masken-Icon, Hinweis `.inco-hero` auf der Startseite. `Strg+Umschalt+N`, Menü, Palette.
- **Snipping-Tool `ui/js/snip.js`** (`Strg+Umschalt+S`, Scheren-Knopf in der Leiste, Palette, Menü, Rechtsklick „Screenshot erstellen …“):
  - Main `snip:capture(id, full)`: sichtbar per `capturePage` (PNG), ganze Seite per DevTools-Protokoll (`Page.captureScreenshot` mit `captureBeyondViewport`, höchstens 16.000 px hoch). Ohne Tab-View wird die Oberfläche fotografiert.
  - UI: View per `hold('snip')` verstecken, Foto über `#viewport` legen, Bereich ziehen (oder Enter = ganze Ansicht), dann Canvas-Editor mit Stift, Marker, Pfeil, Rahmen, Text, Verpixeln, 6 Farben, Rückgängig (25 Schritte), Tasten 1–6, Strg+C/S/Z.
  - `snip:copy`: Electron 45 hat im Main nur noch die Web-artige Zwischenablage (`clipboard.write([new ClipboardItem({'image/png': Blob})])`), ältere `writeImage`. In xvfb nicht prüfbar.
  - `snip:save` → `Bilder\Dulidan Screenshots\Screenshot JJJJ-MM-TT HH-MM-SS.png`, `snip:show` öffnet den Ordner.
- **Autostart:** Einstellung „Mit Windows starten“ → `app.setLoginItemSettings`. Geht nur in der installierten App. Der Schalter liest beim Start den echten Zustand.
- **Tabs robust:**
  - **Übergänge:** `view.transition()` räumt in `finally` immer auf, damit ein Tab nie „im Übergang“ hängen bleibt (sonst bliebe er leer). Notbremse: 8 s.
  - **Wiederherstellen ist lazy:** Nur der aktive Tab lädt, die anderen tragen `t.pending` und laden beim Anklicken. Den Titel holen sie aus dem Verlauf.
  - **Abgestürzte Tabs** laden sich selbst neu: sichtbar sofort, sonst beim Anklicken.
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
  - `SearchProxy.kt`: eigene Seiten unter `https://dulidan.search/`: `search/`, `maps/`, `translate/`, `vendor/maplibre/`, `vendor/bergamot/`, `calc.js`. API wie am Desktop: `/api/fetch` (gleiche Host-Whitelist wie `main.js`, OSM-Dienste mit App-Kennung `DulidanWeb/<ver> (Android; +repo)`), `/api/mapconfig` (OpenFreeMap), `/api/model`. Alles nur mit `x-dw: 1`. `labelOf()` zeigt „Maps · ort“/„Übersetzer · text“ in der Leiste.
  - `Models.kt`: Bergamot-Sprachpakete laden, prüfen, ablegen (wie `main/translate-models.js`)
  - `Updater.kt`: Ablauf beim Start und bei `onResume`, höchstens alle 3 h:
    1. Liest `android-version.json`.
    2. Im WLAN lädt es neue Versionen **automatisch** in den Cache, im Mobilfunk fragt die Pille erst.
    3. Installiert über `PackageInstaller` mit `USER_ACTION_NOT_REQUIRED` (API 31+) und `setRequestUpdateOwnership` (API 34+). Nach dem ersten Selbst-Update kommen die Updates damit ohne Nachfrage, sonst zeigt `UpdateReceiver` die Bestätigung.
    4. Fehlt die Erlaubnis „Apps installieren“, führt die Pille in die Einstellungen.
    5. Passt der Schlüssel nicht, sagt die App ehrlich „einmal neu installieren“.
- **Assets:** `assets/home/` (Startseite, klassische Skripte, Logo als data-URL), `assets/fonts/`. Dazu `shared/` über `sourceSets["main"].assets.srcDir("../../shared")`, also `assets/search/…`, `assets/maps/…`, `assets/translate/…` und `assets/calc.js`.
  - **Vendor:** Task `copyVendor` in `app/build.gradle.kts` kopiert MapLibre (`maplibre-gl.js/.css`) und Bergamot (`translator.js`, `worker/*`) aus `../node_modules` nach `build/vendor-assets/vendor/…`. Darum braucht der APK-Build vorher `npm ci --ignore-scripts` im Repo-Ordner (CI macht das, ohne Electron-Download).
  - **Menü:** zusätzlich „Maps“, „Verkehr“, „Übersetzer“, „Link kopieren“. Shortcuts `maps …` und `tr …` (auch auf der Startseite).
  - **Test:** `tests/e2e/mobileapps.js` (Chromium im Handy-Format, Dateien genau wie in den APK-Assets, GPS erlaubt).
- **Leistung (gegen Ruckeln):**
  - Die Startseite wird pausiert, sobald ein Tab sie verdeckt: `home.onPause()` plus JS `dwPause`. Vorher lief sie unsichtbar weiter.
  - **Automatische Qualitätsstufen in `home.js`:** Schafft das Handy keine ~45 FPS, sinken Nebel-Auflösung und Partikel-DPR, und `body.lite` schaltet teure CSS-Animationen ab.
  - **CSS:** Kein animierter `filter: blur`, kein `backdrop-filter` über WebGL.
  - **Energiestrahl:** Der Animator der unteren Leiste stoppt in `onPause`.
- **Tabs robust:**
  - Wiederherstellen ist lazy, nur der aktive Tab lädt.
  - `activate()` baut eine fehlende WebView neu auf und lädt die URL. Das betrifft Tabs nach einem Renderer-Absturz, bei dem Android oft alle WebViews auf einmal verliert.
  - Stirbt der Renderer der Startseite, wird sie neu gebaut, statt dass die App beendet wird.
- **Farben:**
  - Akzent: 6 Presets plus „eigene Farbe“ über den Spektrum-Regler (`SpectrumBar` in `Panels.kt`). `Dw.apply(key, custom)` leitet die drei Töne ab wie der Desktop.
  - **Widget-Farbe:** „Wie App“, ein Akzent oder eigene Farbe. `SearchWidget` zeichnet Rand, Mikro- und Rechner-Knopf als Bitmap in dieser Farbe, weil sich Verläufe in RemoteViews nicht umfärben lassen.
  - Bei jedem Farbwechsel ruft die App `SearchWidget.refresh()`.
- **Auf Android fehlen noch:** Disko-Modus, Musik-Analyse, Passwörter/Autofill. Vorher fragen. Maps und Übersetzer sind drin.

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
  - `mapnews.js`: Maps-News (Globus, Thema, Land → Schlagzeilen, Klick auf der Karte)
  - `snip.js`: Snipping-Tool (Bereich, Werkzeuge, Speichern, Kopieren, ganze Seite über `fixtures/site/long.html`)
  - `mobileanswers.js`: Sofort-Antworten im Handy-Format
  - `prognose.js`: Liga-Schalter und Prognose (Tipps, Simulation, Abschlusstabelle)
  - `answers.js`: Sofort-Antworten (Wetter, Währung, Einheiten, Bundesliga, Verein, F1) und Inkognito (Cookies weg nach Schließen, kein Verlauf)
  - `mobilesearch.js`: Ergebnisseite im Handy-Format
  - `discotest.js video.html|audio.html`: Disko inklusive Esc, Drops und Screenshots
  - `anatest.js`: Analyse-Werte je Song-Abschnitt
  - `hometest*.js`: Android-Startseite im Browser
  - `calctest.mjs`: Parser-Einheitstests
  - `tabstress.js`: viele Tabs, schnelles Umschalten, Navigieren im Übergang, Absturz, Neustart mit Lazy-Restore
  - `shapes.js`: alle Objekte am Desktop, mit Screenshots in `tests/out/shapes/`
  - `homeshapes.js`: Android-Startseite (Assets plus `shared/` wie in der APK), Objekte, Doppeltipp, Pause, Leistungsstufen
  - `translate.js`: Übersetzer lokal und online.
    - Braucht die Modelle `deen`, `ende`, `enes` plus `registry.json` auf `http://127.0.0.1:8797`. Holen mit curl aus dem Bergamot-Speicher (geht im Container), dann `python3 -m http.server 8797`.
    - Ein fehlendes Paar (z. B. `enfr`) testet den Online-Ausweich.
- **Test-Haken (nur über Umgebungsvariablen aktiv):**
  - `DW_PROXY_BASE=http://127.0.0.1:8799`: der Such-Proxy fragt den Nachbau
  - `DW_LYRICS_BASE=http://127.0.0.1:8798`: LRCLIB-Nachbau
  - `DW_DEBUG=1`: Proxy-Fehler loggen
- **Stolpersteine:**
  - Die Tests nutzen das echte Profil (`~/.config/dulidan-web`). `test4.js` erwartet ein leeres `wallet.json`. `gtest.js` und `test3.js` erwarten ein noch nicht gespeichertes Passwort, also vorher `vault.json` beiseitelegen, sonst meldet sich die App automatisch an.
  - Playwright-Tasten lösen kein `before-input-event` aus. Dafür gibt es einen DOM-Keydown-Ausweich in der Oberfläche.
  - `page.screenshot` zeigt nur die Oberfläche. Tab-Inhalte holt man mit `view.webContents.capturePage()`.
  - Chromiums History-Intervention: Zurück braucht in Tests `userGesture`.
- **Android:** Im Container ging nur die Kompilierprüfung und der Browser-Test der Startseite. Echtes Gerät oder Emulator gab es nie.

---

## 7. NÄCHSTE AUFGABEN (vom Nutzer so abgestimmt)

### 7.1 Lyrics-Timing reparieren (Desktop) – ERLEDIGT (siehe 3.6)
> Umgesetzt: C (YouTube-Untertitel + Live-Untertitel), B (Stimm-Abgleich mit Gate), D (Sync-Taste, pro Video gemerkt). Ungetestet gegen echtes YouTube/LRCLIB. Der Plan unten bleibt als Hintergrund.

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

### 7.2 Neuer Modus „Lyric Motion“ (Desktop) – ERLEDIGT (siehe 3.6)
> Umgesetzt in `main/disco-motion.js`, Startmodus Lyric Motion. Ideen wie Echo-Trails noch nicht drin.

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

### 7.4 Google-Anmeldung am Desktop („Dieser Browser oder diese App ist unter Umständen nicht sicher“)
- **Problem:** Google lehnt die Anmeldung in eingebetteten Chromium-Browsern ab.
- **Lösung:** Auf ausdrücklichen Wunsch des Nutzers umgesetzt. Nur auf `accounts.google.com` und `accounts.youtube.com` tritt Dulidan Web als Firefox auf:
  - In `main.js`: `FIREFOX_UA`, `onBeforeSendHeaders` (setzt den UA-Header, entfernt `sec-ch-ua*`) und `setUserAgent` pro Tab bei Navigation.
  - In `tab-preload.js`: `userAgentData` und `vendor` werden ausgeblendet.
  - Überall sonst bleibt die Chrome-Kennung.
- **Ungetestet gegen das echte Google.** Der Container hatte keinen Zugriff. Wenn Google es weiter ablehnt, mit dem Nutzer besprechen, bevor weiter daran gedreht wird.
- Android ist hier nicht verändert.

## 8. Bekannte Grenzen
- **DRM** (Netflix, Spotify Web): Weder Audio-Analyse noch Video-Textur sind möglich.
- DuckDuckGo kann bei vielen Suchen bremsen. Die Ergebnisseite zeigt dann „Zu viele Suchen auf einmal“ mit „Nochmal versuchen“.
- Die exe ist nicht kostenpflichtig signiert, deshalb erscheint beim ersten Start die SmartScreen-Warnung („Weitere Informationen → Trotzdem ausführen“).
- Ungetestet: Windows selbst (nur CI-Builds), echte Android-Geräte, echte YouTube/LRCLIB/DuckDuckGo-Antworten (der Container hatte keinen Zugriff) und DPAPI.
