# Dulidan Web

Ein Desktop-Browser von **Dulidan Studios**, gebaut mit Electron. Version 0.1 konzentriert sich auf Optik, die Suchleiste und übertrieben epische Animationen. Farben, Easing-Kurven, Radien, Glow-Effekte und Schriften stammen direkt von [dulidan-studios.com](https://dulidan-studios.com).

> Dream. Design. Develop. Dominate.

## Windows: einfach die exe

`DulidanWeb.exe` herunterladen und doppelklicken. Eine Installation, Node.js oder sonst etwas ist nicht nötig. Die exe findest du unter **Releases → „Dulidan Web (neuester Build)"**. Der Workflow `.github/workflows/build-exe.yml` baut sie bei jedem Push neu.

Beim ersten Start zeigt Windows eventuell „Der Computer wurde durch Windows geschützt", weil die exe nicht kostenpflichtig signiert ist. Dann auf **Weitere Informationen → Trotzdem ausführen** klicken.

Selbst bauen: `npm install` und dann `npm run dist`. Die exe landet in `dist/`.

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
| `Strg+D` | Lesezeichen setzen oder entfernen |
| `Strg+J` | Downloads |
| `Strg+,` | Einstellungen |
| `F5` / `Strg+R` | Neu laden |
| `Alt+←` / `Alt+→` | Zurück / Vor |
| `Alt+Pos1` | Startseite |
| `F11` | Vollbild |

## Suche

Eine einzige Leiste für Adressen und Suche. Eingaben ohne Domain werden gesucht, standardmäßig mit DuckDuckGo (in den Einstellungen änderbar: Google, Bing, Brave, Ecosia, Startpage).

Such-Shortcuts: Wenn du ein Kürzel und ein Leerzeichen tippst, wird daraus ein Chip.

| Kürzel | Ziel |
| --- | --- |
| `yt …` | YouTube |
| `gh …` | GitHub |
| `wiki …` | Wikipedia (de) |
| `maps …` | Google Maps |
| `mc …` | Minecraft Wiki (de) |

Mit Rücktaste in der leeren Leiste entfernst du den Chip wieder.

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
- **Einstellungen:** Suchmaschine, Animationen (Normal, Episch, Aus), Akzentfarbe (sechs Presets und eine freie Farbe), Mikro-Sounds (standardmäßig aus). `prefers-reduced-motion` wird respektiert: Ist es aktiv, steht der Standard auf „Aus".

Ohne WebGL (etwa ohne GPU) erscheint automatisch das statische Logo.

## Aufbau

```
main.js          Main-Prozess: Fenster (frameless), Tabs als WebContentsView, Protokoll dulidan://, IPC, Downloads
preload.js       Schmale IPC-Brücke für die Oberfläche (contextBridge)
tab-preload.js   Läuft isoliert in Webseiten und meldet nur den Scroll-Fortschritt
ui/              Oberfläche: Vanilla HTML/CSS/JS, ES-Module, kein Build-Schritt
  css/           tokens · chrome · home · overlays · error
  js/            app · tabs · omnibox · view · morph · overview · audio · gl · fx · palette · panels · boot · settings · data · sound · util
assets/          Logo und Schriften (Space Grotesk, JetBrains Mono, OFL)
```

### Wie Overlays über Webseiten liegen

Eine `WebContentsView` liegt immer über der HTML-Oberfläche. Bevor ein Dropdown, die Palette, ein Panel oder ein Übergang erscheint, fotografiert Dulidan Web die Seite (`capturePage`). Das Foto kommt unter die Oberfläche, und die echte View wird versteckt. Der Logo-Wipe am Ende eines Seitenwechsels läuft per `executeJavaScriptInIsolatedWorld` direkt in der neuen Seite, ohne `innerHTML` und damit kompatibel mit CSP und Trusted Types.

### Wie die Musik-Reaktion funktioniert

`tab-preload.js` greift den Ton von `<video>`- und `<audio>`-Elementen über `captureStream()` ab. Die Wiedergabe der Seite bleibt dabei unverändert. Ein Analyser liefert Bass, Mitten und Höhen rund 30-mal pro Sekunde an die Oberfläche. Geschützte Medien (DRM, etwa Spotify oder Netflix) und fremde Medien ohne CORS geben aus Sicherheitsgründen keinen Ton heraus. Dort bleibt die Musik-Reaktion aus. Damit die Analyse auch in Hintergrund-Tabs weiterläuft, haben Tabs `backgroundThrottling: false`.

### Sicherheit

- `contextIsolation: true`, `nodeIntegration: false` und `sandbox: true` für Oberfläche und Tabs
- Die Oberfläche läuft über ein eigenes Protokoll `dulidan://app/` mit strenger CSP. Es liefert nur `ui/` und `assets/` aus und blockt Path-Traversal.
- IPC-Aufrufe werden nur von der Oberfläche angenommen. Navigation erlaubt nur `http(s)`, `file` und `dulidan`.
- `window.open` wird zu einem neuen Tab, `<webview>` ist gesperrt, Berechtigungen sind standardmäßig abgelehnt (bis auf Vollbild und das Schreiben in die Zwischenablage).

## Lizenz der Schriften

Space Grotesk und JetBrains Mono stehen unter der SIL Open Font License, siehe `assets/fonts/`.
