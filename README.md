# Dulidan Web

Ein Desktop-Browser von **Dulidan Studios**, gebaut mit Electron. Version 0.1 konzentriert sich auf Optik, die Suchleiste und übertrieben epische Animationen. Farben, Easing-Kurven, Radien, Glow-Effekte und Schriften stammen direkt von [dulidan-studios.com](https://dulidan-studios.com).

> Dream. Design. Develop. Dominate.

## Windows: einfach die exe

`DulidanWeb.exe` herunterladen und doppelklicken. Eine Installation, Node.js oder sonst etwas ist nicht nötig. Die exe findest du unter **Releases → „Dulidan Web (neuester Build)"**. Der Workflow `.github/workflows/build-exe.yml` baut sie bei jedem Push neu.

Beim ersten Start zeigt Windows eventuell „Der Computer wurde durch Windows geschützt", weil die exe nicht kostenpflichtig signiert ist. Dann auf **Weitere Informationen → Trotzdem ausführen** klicken.

Selbst bauen: `npm install` und dann `npm run dist`. Die exe landet in `dist/`.

## Android: die APK

`DulidanWeb.apk` aufs Handy laden und öffnen. Sie liegt unter **Releases → „Dulidan Web für Android (neuester Build)“**. Beim ersten Mal fragt Android, ob Installationen aus dieser Quelle erlaubt sind; das einmal erlauben.

Die Android-Version ist eine eigene native App (Kotlin + Android-WebView) im Ordner `android/`:

- **Startseite:**
  - Das Partikel-D weicht dem Finger aus, Tippen löst eine Schockwelle mit Vibration aus.
  - Nebel und Logo kippen mit dem Gyroskop mit.
  - Dazu eine Riesen-Suchleiste mit Energiestrahl, Shortcut-Chips, Schnellzugriff, Uhr und Slogan-Bänder.
- **Untere Leiste für den Daumen:** Adressleiste mit rotierendem Energiestrahl, Ladelinie und Werbeblocker-Zähler.
- **Seitenwechsel als Partikel-Morph:** Die alte Seite zerfällt, fliegt zum D und explodiert in die neue Seite.
- **Tab-Übersicht als 3D-Karten-Stapel:** Wischen lässt eine Karte in Partikel zerfallen, Antippen zoomt hinein.
- **Funktionen:**
  - Live-Vorschläge, Werbeblocker (Hosts-Liste), Tabs wiederherstellen, Vollbild-Videos, Downloads, Datei-Upload.
  - Teilen, Desktop-Version, Boot-Sequenz.
  - Rechner: über den Knopf oben auf der Startseite oder im Menü. Er fällt von oben ein, Wischen nach oben schließt ihn.
    - Tippst du eine Rechnung ins Suchfeld (etwa `12*(3+4)`), steht das Ergebnis sofort darunter.
    - Enter öffnet den Rechner, Antippen des Vorschlags kopiert das Ergebnis.
- **Widget „Dulidan Suche“ für den Startbildschirm:** Menü → „Widget“ legt es direkt ab. Alternativ: Startbildschirm lange drücken → Widgets → Dulidan Web.
  - Tippen öffnet einen leeren Tab mit Tastatur.
  - Das Mikrofon startet die Sprachsuche.
  - Der Rechner-Knopf öffnet sofort den Rechner.
  - Dulidan Web lässt sich als Standard-Browser wählen.

Gebaut wird die APK vom Workflow `.github/workflows/build-apk.yml`. **Signierschlüssel:** Ohne Secret erzeugt jeder Build einen neuen Schlüssel. Dann muss man vor einem Update die alte Version deinstallieren. Für nahtlose Updates legt man einmalig die Repository-Secrets `DW_KEYSTORE` (Keystore als Base64) und `DW_KEYSTORE_PASS` an. Der Schlüssel gehört nie ins Repo.

## Starten (Entwicklung)

Voraussetzung: [Node.js](https://nodejs.org) 20 oder neuer.

```bash
npm install
npm start
```

**Nur herunterladen?** `dulidan-web.zip` im Repo enthält das komplette Projekt (ohne `node_modules`). Entpacken, im Ordner `npm install` und `npm start` ausführen.

Beim ersten Start läuft die Boot-Sequenz (mit Enter oder Esc überspringbar). Sie lässt sich in den Einstellungen erneut abspielen.

## Tastenkürzel

| Kürzel | Aktion |
| --- | --- |
| `Strg+T` | Neuer Tab |
| `Strg+W` | Tab schließen |
| `Strg+Tab` / `Strg+Umschalt+Tab` | Nächster / vorheriger Tab |
| `Strg+L` | Adressleiste fokussieren |
| `Strg+K` | Command Palette (Tabs, Lesezeichen, Verlauf, Befehle) |
| `Strg+E` | Orbit: 3D-Tab-Übersicht |
| `Strg+F` / `F3` | Auf der Seite suchen / nächster Treffer |
| `Strg +` / `Strg -` / `Strg 0` | Zoom größer / kleiner / zurücksetzen |
| `Strg+D` | Lesezeichen setzen oder entfernen |
| `Strg+J` | Downloads |
| `Strg+,` | Einstellungen |
| `Strg+Umschalt+R` | Taschenrechner |
| `F5` / `Strg+R` | Neu laden |
| `Alt+←` / `Alt+→` | Zurück / Vor |
| `Alt+Pos1` | Startseite |
| `F11` | Vollbild |

## Suche

Eine einzige Leiste für Adressen und Suche. Eingaben ohne Domain landen auf der **eigenen Ergebnisseite „Dulidan Suche“** und nicht auf der weißen Seite einer Suchmaschine. Das gilt am PC und auf dem Handy.

- **Ergebnisse im Dulidan-Look:**
  - Karten mit Favicon, Pfad und hervorgehobenen Suchbegriffen. Anzeigen werden herausgefiltert.
  - Beim Scrollen lädt die Seite endlos nach.
  - Zurück springt ohne neues Laden an dieselbe Stelle.
- **Tabs:**
  - Alle
  - Bilder als Mosaik mit Lightbox
  - Videos mit Vorschaubild, Dauer und Aufrufen
  - News mit Quelle und „vor 3 Std.“
- **Sofortantworten:** eine Wikipedia-Karte zum Begriff. Bei Rechnungen wie `200*15%` erscheint eine Rechner-Karte mit dem Ergebnis.
- **Woher die Treffer kommen:** Die App holt sie im Hintergrund von DuckDuckGo, also ohne Tracking und ohne API-Schlüssel, dazu Wikipedia. Angezeigt wird alles nur in der eigenen Seite.
  - Der Abruf läuft über einen kleinen Proxy in der App. Er spricht ausschließlich diese festen Quellen an und ist nur für die Ergebnisseite selbst nutzbar, fremde Webseiten kommen nicht an ihn heran.
- **Andere Suchmaschine:** Wer doch eine möchte, kann sie in den Einstellungen wählen (DuckDuckGo, Google, Bing, Brave, Ecosia, Startpage).
- **Gemeinsamer Code:** Die Seite liegt in `shared/search/`. Desktop und Android benutzen dieselben Dateien.

Such-Shortcuts: Wenn du ein Kürzel und ein Leerzeichen tippst, wird daraus ein Chip.

| Kürzel | Ziel |
| --- | --- |
| `yt …` | YouTube |
| `gh …` | GitHub |
| `wiki …` | Wikipedia (de) |
| `maps …` | Google Maps |
| `mc …` | Minecraft Wiki (de) |

Mit Rücktaste in der leeren Leiste entfernst du den Chip wieder.

Rechnen geht direkt in der Leiste. Bei `200*15%` steht als erster Vorschlag `= 30`, Enter kopiert das Ergebnis. Unterstützt werden:

- `+ − × ÷ ^ % !` und Klammern
- `√`/`sqrt`, `sin`/`cos`/`tan` (in Grad), `log`, `ln`, `π`, `e`
- Komma als Dezimalzeichen

## Was drin ist

- **Start-Erlebnis:** Boot-Sequenz im Terminal-Look, ein WebGL-Partikel-D mit eigenem Shader (setzt sich zusammen, weicht der Maus aus, zerfällt bei Klick in Schockwellen), ein Nebel-Shader, der auf die Maus reagiert, eine Live-Uhr, Wetter als HUD und das Slogan-Band.
- **Suchleiste:** pulsierender Glow, ein Energiestrahl, der beim Tippen um die Leiste rast, Live-Vorschläge mit Stagger und Feder-Highlight, eine Schockwelle beim Absenden und ein leuchtender Ladebalken.
- **Animationen:** Custom Cursor (Ring und Punkt, rastet auf Buttons ein, zeigt Labels), magnetische Buttons, Ripple, Mikro-Bounce, Icon-Rotation, Tilt und Spotlight auf Karten. Tabs wachsen elastisch ein, zerfallen beim Schließen in Partikel und lassen sich mit physikalischem Gefühl ziehen. Der aktive Tab hat einen wandernden Glow. Seitenwechsel laufen mit Logo-Wipe, Panels gleiten mit Blur, Skalierung und Stagger ein, und das Fenster schließt mit einem CRT-Effekt.
- **Orbit (3D-Tab-Übersicht, `Strg+E`):** Alle Tabs schweben als Live-Vorschauen auf einer Spirale im WebGL-Raum, mit Sternenfeld und Gitterboden.
  - Mit der Maus fliegst du, mit Mausrad oder Pfeiltasten geht es durch die Tabs.
  - Klick oder Enter zoomt in eine Karte hinein, bis sie exakt die Seite füllt. Erst dann erscheint die echte Seite.
  - `Entf` schließt einen Tab, `Esc` zoomt zurück in den aktiven Tab.
- **Partikel-Übergang:** Beim Seitenwechsel zerfällt das Foto der alten Seite in rund 26 000 Partikel, die zum Dulidan-D zusammenfliegen. Ist die neue Seite geladen, wird sie unsichtbar fotografiert. Dann explodiert das D, und die neue Seite erscheint in einem wachsenden Kreis mit Schockwellen-Ring. Ohne WebGL läuft weiter der Logo-Wipe.
- **Musik-Reaktion:** Läuft in einem Tab Ton (etwa YouTube), pulsieren Logo-Partikel, Nebel, Energiestrahl und Glow zum Bass. Starke Kicks lassen das D beben, und der Tab zeigt einen Mini-Equalizer. Das funktioniert auch, während du auf einem anderen Tab bist.
- **Passwort-Manager:** Nach dem Anmelden fragt die Adressleiste „Passwort speichern?“. Beim nächsten Besuch füllt Dulidan Web Benutzername und Passwort ein und meldet dich automatisch an.
  - Auch zweistufige Logins wie bei Google oder Microsoft gehen: erst die E-Mail, dann das Passwort.
  - Für YouTube und Google meldet sich Dulidan Web als normales Chrome. Mit „Electron“ in der Browser-Kennung würde Google die Anmeldung blockieren („Dieser Browser ist möglicherweise nicht sicher“).
  - Verwalten kannst du alles über den Schlüssel in der Adressleiste, im Menü oder in der Palette: suchen, anzeigen, kopieren (die Zwischenablage wird nach 30 s geleert) und löschen.
  - Ist ein gespeichertes Passwort falsch, gibt es höchstens einen automatischen Versuch pro Minute, also keine Endlosschleife.
- **Adressen & Karten:** Nach dem Absenden eines Formulars fragt Dulidan Web „Adresse speichern?“ bzw. „Karte •••• 4242 speichern?“.
  - Beim nächsten Mal erscheint direkt am Feld ein Vorschlag. Ausgefüllt wird erst nach deinem Klick, **abgeschickt wird nie automatisch**. „Bestellen“ oder „Bezahlen“ drückst du immer selbst.
  - Die Prüfnummer (CVC) wird nie gespeichert.
  - Es funktioniert auch mit Bezahlfeldern in iframes (Stripe, Adyen …). Kartendaten gehen dabei nur an Rahmen derselben Herkunft wie das angeklickte Feld, nie in fremde iframes.
  - Verwalten kannst du alles unter Menü → „Adressen & Karten“.
- **Werbeblocker:** Ghostery-Engine mit Werbe- und Tracker-Listen. Das Schild in der Adressleiste zählt, was auf der Seite blockiert wurde. Abschalten kannst du ihn in den Einstellungen.
- **Tabs wiederherstellen:** Beim Start sind deine Tabs wieder da. Abschalten kannst du das in den Einstellungen.
- **Rechtsklick-Menü:** Link oder Bild in neuem Tab öffnen, speichern und kopieren, markierten Text im Web suchen, Rechtschreibvorschläge, Untersuchen.
- **Taschenrechner** (Knopf oben rechts in der Leiste oder `Strg+Umschalt+R`): Das Panel fällt mit Feder ein und funktioniert mit Maus und Tastatur.
  - Das Ergebnis erscheint live, `=` löst einen Partikel-Burst aus.
  - Die letzten Rechnungen bleiben als Verlauf stehen, Kopieren geht per Klick.
  - Ein eigener Parser rechnet, `eval` wird nie benutzt.
- **Suchen auf der Seite und Zoom** pro Tab, mit Trefferzähler und Zoom-Anzeige.
- **Einstellungen:** Suchmaschine, Animationen (Normal, Episch, Aus), Akzentfarbe (sechs Presets und eine freie Farbe), Mikro-Sounds (standardmäßig aus). `prefers-reduced-motion` wird respektiert: Ist es aktiv, steht der Standard auf „Aus".

Ohne WebGL (etwa ohne GPU) erscheint automatisch das statische Logo.

## Aufbau

```
main.js          Main-Prozess: Fenster (frameless), Tabs als WebContentsView, Protokoll dulidan://, IPC, Downloads
main/            passwords.js (Tresor) · wallet.js (Adressen & Karten) · adblock.js (Werbeblocker) · contextmenu.js (Rechtsklick)
preload.js       Schmale IPC-Brücke für die Oberfläche (contextBridge)
tab-preload.js   Läuft isoliert in Webseiten und meldet nur den Scroll-Fortschritt
ui/              Oberfläche: Vanilla HTML/CSS/JS, ES-Module, kein Build-Schritt
  css/           tokens · chrome · home · overlays · error
  js/            app · tabs · omnibox · view · morph · overview · audio · passwords · wallet · gl · fx · palette · panels · boot · settings · data · sound · util
assets/          Logo und Schriften (Space Grotesk, JetBrains Mono, OFL)
```

### Wie Overlays über Webseiten liegen

Eine `WebContentsView` liegt immer über der HTML-Oberfläche. Bevor ein Dropdown, die Palette, ein Panel oder ein Übergang erscheint, fotografiert Dulidan Web die Seite (`capturePage`). Das Foto kommt unter die Oberfläche, und die echte View wird versteckt. Der Logo-Wipe am Ende eines Seitenwechsels läuft per `executeJavaScriptInIsolatedWorld` direkt in der neuen Seite, ohne `innerHTML` und damit kompatibel mit CSP und Trusted Types.

### Wie die Musik-Reaktion funktioniert

`tab-preload.js` greift den Ton von `<video>`- und `<audio>`-Elementen über `captureStream()` ab. Die Wiedergabe der Seite bleibt dabei unverändert. Ein Analyser liefert Bass, Mitten und Höhen rund 30-mal pro Sekunde an die Oberfläche. Geschützte Medien (DRM, etwa Spotify oder Netflix) und fremde Medien ohne CORS geben aus Sicherheitsgründen keinen Ton heraus. Dort bleibt die Musik-Reaktion aus. Damit die Analyse auch in Hintergrund-Tabs weiterläuft, haben Tabs `backgroundThrottling: false`.

### Wo die Passwörter liegen

Alles bleibt lokal in `vault.json` (Passwörter) und `wallet.json` (Adressen & Karten) im App-Datenordner (Windows: `%APPDATA%\dulidan-web`). Jedes Passwort ist einzeln mit Electrons `safeStorage` verschlüsselt, unter Windows ist das **DPAPI**. Nur dein Windows-Benutzerkonto auf diesem PC kann es entschlüsseln. Gibt es keinen System-Schlüsselbund (manche Linux-Systeme), verschlüsselt Dulidan Web mit AES-256-GCM und einem zufälligen lokalen Schlüssel.

- Welche Zugangsdaten eine Seite bekommt, entscheidet der Main-Prozess anhand der echten Frame-URL, nie die Webseite selbst. Ausgefüllt wird nur im Hauptframe und nur auf `https` (plus `localhost` zum Entwickeln).
- Beim Speichern bekommt die Oberfläche das Passwort nie zu sehen. Sie sagt dem Main-Prozess nur „speichern“ oder „nie“.

### Sicherheit

- Webseiten laufen in einer eigenen Session (`persist:web`), getrennt von der Oberfläche.
- `contextIsolation: true`, `nodeIntegration: false` und `sandbox: true` für Oberfläche und Tabs
- Die Oberfläche läuft über ein eigenes Protokoll `dulidan://app/` mit strenger CSP. Es liefert nur `ui/` und `assets/` aus und blockt Path-Traversal.
- IPC-Aufrufe werden nur von der Oberfläche angenommen. Navigation erlaubt nur `http(s)`, `file` und `dulidan`.
- `window.open` wird zu einem neuen Tab, `<webview>` ist gesperrt, Berechtigungen sind standardmäßig abgelehnt (bis auf Vollbild und das Schreiben in die Zwischenablage).

## Lizenz der Schriften

Space Grotesk und JetBrains Mono stehen unter der SIL Open Font License, siehe `assets/fonts/`.
