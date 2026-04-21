# LinkHub – Review und Vorschläge für neue Features

Stand: April 2026
Scope: `src/`, `extension/`, `doc/`, `public/` sowie die öffentlich dokumentierte Feature-Liste im [README.md](../README.md).

Diese Review bewertet den aktuellen Funktionsumfang und schlägt konkrete, umsetzbare Erweiterungen vor. Die Vorschläge sind bewusst local-first und respektieren die bestehende Architektur (Zustand, Zod-Contracts, IndexedDB + localStorage, React 19, Vite 8).

---

## 1. Kurzbewertung des Ist-Stands

### Stärken

- **Klare Architekturtrennung**: Contracts ([`src/contracts`](../src/contracts)), Feature-Module ([`src/features`](../src/features)), State-Slices ([`src/state/slices`](../src/state/slices)) und Storage-Repositories ([`src/storage`](../src/storage)) sind sauber getrennt.
- **Zod-validierte Persistenz** mit versioniertem Schema und Migrationen ([`src/storage/storageMigrations.ts`](../src/storage/storageMigrations.ts)).
- **Local-first**: keine Pflicht-Cloud, keine Analytics-Pixel, nur ein externer Favicon-Lookup gegen Google.
- **Cross-Browser-Extension-Pipeline** für Chrome, Edge, Firefox inklusive Deploy-Scripts.
- **Test-Fundament** steht (Vitest + Playwright), Coverage wird im Root ausgewiesen.

### Schwachstellen / Risiken

- **Externer Favicon-Dienst** (`www.google.com/s2/favicons`) ist ein Datenschutz- und Offline-Risiko für eine local-first App – jeder neue Link meldet den Host an Google.
- **Keine Volltextsuche / kein Command-Palette-Einstieg** sichtbar – bei vielen Karten wird räumliche Navigation allein ermüdend.
- **Analytics-Modell** (`workspaceAnalytics`) bleibt in `day/week/month/year/total` Buckets – ohne Heatmap, ohne „zuletzt benutzt", ohne Tag-Aggregation.
- **Kein Tagging / keine Labels** auf Karten-Ebene (Schema in [`src/contracts/linkCard.ts`](../src/contracts/linkCard.ts) sieht keine Tags vor).
- **Kein Broken-Link-Check**, obwohl Karten beliebig lange liegen bleiben.
- **Kein Import aus Browser-Bookmarks** (HTML `Netscape-Bookmark-File-1`), obwohl das die Haupt-Einstiegshürde für neue Nutzer ist.
- **Keine Verschlüsselung der Exporte** – `.linkhub.zip` enthält komplette URLs und Bilder im Klartext.
- **Keine Sync-Option**, auch nicht optional (z. B. WebDAV, Dateisystem-Handle, Drive-Export) – für Multi-Device-Nutzer ein echter Bruch.
- **Zustand-Stores** sind nach Slices getrennt, aber es gibt keine sichtbare Persistenz-Debounce-Dokumentation – Schreiblast bei großen Workspaces sollte gemessen werden.
- **`typescript: ~6.0.3` und `vite: ^8`** sind sehr frühe Majors; bei größeren Abhängigkeits-Bumps sollte ein Kompatibilitäts-Smoketest fest im CI stehen.

---

## 2. Feature-Vorschläge nach Priorität

Priorisierung: **P1** = hoher Nutzen, geringer Aufwand · **P2** = hoher Nutzen, mittlerer Aufwand · **P3** = strategisch, größerer Aufwand.

### P1 – Schnelle Gewinne

#### 1.1 Import aus Browser-Bookmarks (HTML)

- Parser für `Netscape-Bookmark-File-1`-Export aus Chrome, Edge, Firefox, Safari.
- Ordner-Hierarchie auf verschachtelte Gruppen mappen, Bookmarklets ausfiltern.
- Vorschau-Dialog: Anzahl Links pro Ordner, Duplikat-Erkennung per normalisierter URL.
- Einstieg: neuer Button in [`OptionsDataSection.tsx`](../src/components/taskbar/OptionsDataSection.tsx).

**Warum P1**: senkt die Einstiegshürde massiv, nutzt vorhandene Gruppen-Semantik, kein neuer Contract nötig (nur `createLinkCard`-Aufrufe).

#### 1.2 Lokaler Favicon-Cache statt Live-Lookup

- Favicon beim Anlegen einmal laden, als Blob in `image_assets` / `image_blobs` ablegen, `faviconOverrideImageId` analog zum Upload nutzen.
- Fallback-Kette: `https://<host>/favicon.ico` → Google-Service → Platzhalter-Initial-Chip.
- Opt-out-Schalter „Favicons offline-only" in den Optionen, der den Google-Call komplett deaktiviert.

**Warum P1**: entschärft die Datenschutz-Aussage im README, spart Netz-Traffic, verbessert Offline-Verhalten (Extension öffnet oft ohne Netz).

#### 1.3 Globale Suche / Command Palette (Strg+K)

- Suche über Karten (Titel, URL, Tags, Gruppenpfad), Templates, Themes, Workspaces.
- Ergebnis-Aktion: „springe auf Karte" (Viewport zentriert + Highlight), „öffne Link", „duplizieren".
- Reine Client-Suche, kleine invertierte Index-Map im Store-Selektor.

**Warum P1**: räumliche UX skaliert nicht ohne Sprungziel; Tastatur-Nutzer bekommen Power-Mode.

#### 1.4 Broken-Link-Checker (manuell, per Batch)

- In den Options-Data-Bereich ein Button „Links prüfen" legen.
- `fetch(url, { method: 'HEAD', mode: 'no-cors' })` pro Host gedrosselt, Timeout 5 s, Ergebnis als transienter Karten-Status (z. B. gelbes Warnbadge).
- Kein automatischer Hintergrund-Scan, nur auf Nutzer-Wunsch – bleibt local-first-konform.

**Warum P1**: pflegeleichter Canvas, verhindert Karten-Leichen.

#### 1.5 Mehrfach-Öffnen / „Alle öffnen in dieser Gruppe"

- Gruppen-Kontextmenü-Eintrag „Alle Links öffnen" (in neuen Tabs, optional im Gruppen-Fenster der Extension).
- Schwellwert-Dialog ab z. B. 8 Links, um Tab-Explosion zu verhindern.

---

### P2 – Deutlicher Mehrwert, mittlerer Aufwand

#### 2.1 Tags / Labels auf Karten

- Erweiterung von [`LinkCardSchema`](../src/contracts/linkCard.ts) um `tags: z.array(z.string().min(1)).optional()`.
- Migration in [`storageMigrations.ts`](../src/storage/storageMigrations.ts) (DB-Version +1, Default `[]`).
- Filterleiste im Taskbar-Bereich, Klick auf Tag blendet nicht passende Karten dezent aus (Opacity + nicht-interaktiv) statt sie zu entfernen – passt zu „infinite canvas".
- Tag-basierte Statistik: „Top 5 Tags nach Clicks".

#### 2.2 Notizen-/Sticky-Node-Typ

- Neuer Node-Typ `stickyNode` neben `linkCard` und `pictureNode`.
- Markdown- oder Plaintext-Inhalt, eigene Größen- und Farb-Controls, gleiche Snap-/Select-/Copy-Mechanik.
- Für Context auf dem Canvas (Projekt-Beschreibungen, Quelle eines Link-Clusters).

#### 2.3 Verknüpfungen / Pfeile zwischen Nodes

- Optionale `edges`-Liste im Workspace-Contract.
- Einfache Bezier-/Orthogonal-Linien zwischen zwei Nodes, ohne Routing-Engine (bewusst simpel gehalten, Excalidraw-Feel).
- Toggle „Verbindungen anzeigen" im Appearance-Bereich.

#### 2.4 Template-Marktplatz – lokal kuratiert

- Kuratierte Templates im Repo unter `public/templates/` (JSON + Vorschaubild).
- Ladepfad gegenüber Import identisch (nur ohne File-Picker), keine Remote-Fetches.
- Beispiele: „Daily Dashboard", „Research Board", „Dev Links", „News Morning Routine".

#### 2.5 Verschlüsselte Exporte

- Export-Dialog-Option „Mit Passwort schützen (AES-GCM)".
- Web Crypto API, PBKDF2 mit 600k Iterationen, Passwort wird nicht gespeichert.
- Import erkennt verschlüsselte Bundles am Magic-Byte-Header und fragt nach Passwort.
- Nur eine zusätzliche Utility, keine neuen Abhängigkeiten.

#### 2.6 Auto-Backup ins lokale Dateisystem

- File System Access API (Chromium + Edge; Firefox: Download-Fallback).
- Einstellbarer Zielordner, Rotations-Schema (z. B. letzte 7 Tage + letzte 4 Wochen).
- Ereignis-basiertes Backup nach Workspace-Mutation, debounced auf z. B. 60 s.

#### 2.7 Erweiterte Analytics-Sichten

- Heatmap (365 Tage) analog GitHub-Contributions für Link-Öffnungen gesamt.
- „Never opened" Liste: Karten, die älter als 30 Tage und nie geklickt sind, mit Aufräumen-Aktion.
- „Vorgeschlagene Aufräum-Kandidaten": selten geöffnet + alt + broken.

#### 2.8 Keyboard-Nav / Accessibility

- Tab-Order über Karten in Viewport-Reihenfolge, `Enter` öffnet Link, `F2` rename, `Delete` löscht.
- `role`- und `aria-label`-Audit auf Canvas-Nodes (Screenreader-Nutzung auf unendlichem Canvas ist notorisch schwer, aber zumindest Gruppen-Navigation ist machbar).
- High-Contrast-Theme zusätzlich zu den bestehenden sechs.

---

### P3 – Strategisch, größerer Aufwand

#### 3.1 Optionale Ende-zu-Ende-Sync

- Backend-agnostisch: WebDAV, Dropbox, Google Drive, GitHub Gist – alle nur als Opt-in-Adapter.
- Sync-Objekt ist immer das bereits existierende verschlüsselte Bundle (siehe 2.5), damit der Anbieter nie Klartext sieht.
- Konflikt-Strategie: last-writer-wins auf Workspace-Level, manueller Merge-Dialog bei divergierender `updatedAt`.

#### 3.2 PWA-Modus mit Share Target

- Web-App-Manifest + Service Worker für die gehostete Version.
- `share_target` erlaubt „Teilen → LinkHub" auf Android, sodass eine URL direkt als Karte landet.
- Offline-Shell, damit die Web-Version ohne Netz weiter funktioniert.

#### 3.3 Extension-Kontextmenü „Zu LinkHub hinzufügen"

- MV3-Background-Worker, der `chrome.contextMenus` registriert.
- Zielauswahl: aktueller Workspace + optional Zielgruppe.
- Benötigt einen schmalen Messaging-Layer zwischen Background und New-Tab-Page (oder persistenten Write direkt in IndexedDB via `chrome.storage`-Bridge; beachten: Extension-Storage-Kontext ≠ Seiten-IndexedDB – hier Entwurf prüfen).

#### 3.4 Mehrspieler-Variante auf einem Gerät („Profile")

- Mehrere unabhängige Storage-Namespaces (`linkhub.<profile>.*`), Profil-Switcher oben rechts.
- Nützlich für „Arbeit / Privat / Projekt X" auf derselben Maschine.

#### 3.5 Smart-Bucket für neue Links

- Tray-Bereich „Inbox" für schnell hineingeworfene Links.
- Drag-to-canvas triggert Platzierung; alles was nach 7 Tagen noch in der Inbox liegt, wird markiert.

#### 3.6 Lokale Text-Extraktion für bessere Suche

- Beim Anlegen einer Karte optional `fetch` der Zielseite (nur same-origin-freundlich; CORS-sensible Hosts überspringen).
- `<title>` und `<meta name="description">` cachen, in den Suchindex (1.3) einspeisen.
- Strikt optional, per Setting „Linkvorschau aus Seite lesen" defaultmäßig aus.

---

## 3. Architektur- und Qualitäts-Empfehlungen

Diese Punkte sind keine Features, aber sie unterstützen jedes der obigen Items.

- **Contract-Migration-Test**: pro Bump in [`storageMigrations.ts`](../src/storage/storageMigrations.ts) einen Fixture-basierten Vitest aufnehmen, der die alte DB-Version auf die neue migriert und Zod-Validierung bestehen muss.
- **Perf-Budget für Canvas**: `react-window`- oder eigenes Viewport-Culling, sobald Karten-Anzahl > 500 im Test überschritten wird. Heute keine offensichtliche Culling-Strategie sichtbar.
- **Debounced Persistence Messbar machen**: eine kleine Dev-Overlay-Anzeige (`import.meta.env.DEV`) mit „letzter Save vor N ms, Größe K KB" hilft bei späteren Regression-Checks.
- **Extension MV3-Härtung**: `content_security_policy` im [`manifest.json`](../extension/manifest.json) ohne `unsafe-eval`, falls noch vorhanden; `host_permissions` auf das Minimum reduzieren (aktuell via Favicon-Service potenziell `https://www.google.com/*` – entfällt nach 1.2).
- **Playwright-E2E pro P1-Feature**: mindestens ein Happy-Path-Test je neuem Feature unter `tests/e2e/` – konsistent mit der bestehenden Teststruktur.
- **Telemetrie bleibt aus**: selbst bei optionalem Sync (3.1) keine Nutzungstelemetrie einführen, um die Produktaussage „no behavioral tracking" aus dem [README.md](../README.md) nicht zu verwässern.

---

## 4. Vorgeschlagener Release-Pfad

| Release | Umfang | Kernnutzen |
| ------- | ------ | ---------- |
| 1.1     | 1.1, 1.2, 1.5 | Onboarding + Privacy-Härtung |
| 1.2     | 1.3, 1.4, 2.8 | Power-User-UX + Wartbarkeit |
| 1.3     | 2.1, 2.2, 2.4 | Inhaltliche Tiefe (Tags, Sticky, Templates) |
| 1.4     | 2.5, 2.6, 2.7 | Daten-Hoheit + tiefere Insights |
| 2.0     | 2.3 + eine P3-Option (vorzugsweise 3.2 PWA oder 3.3 Context-Menu) | Strategische Verbreiterung |

Jede Stufe bleibt eigenständig auslieferbar und bricht keine bestehenden Exporte, weil alle Schema-Erweiterungen additiv und durch Migrationen abgesichert werden.

---

## 5. Offene Entscheidungspunkte für dich

1. Soll Favicon-Offline-Cache (1.2) direkt Default werden oder Opt-in? Default spart am meisten Privacy-Narrative, bricht aber kurzfristig bestehende Karten ohne Netz beim ersten Start.
2. Tags (2.1) als frei eingebbar oder aus festem Vokabular je Workspace?
3. Verschlüsselte Exporte (2.5): Passphrase pro Export oder ein gemerkter Workspace-Key (bewusst riskant)?
4. Sync (3.1): welcher Adapter zuerst – WebDAV (Nerd-Freundlich, unabhängig) oder Google Drive (massentauglich)?
5. PWA (3.2) vs. Extension-Context-Menu (3.3) als 2.0-Headliner?

Wenn du priorisierst, mache ich direkt eine konkrete Implementierungsskizze (Contract-Diff, Migration, UI-Einstiegspunkte, Tests) für die gewählte Story.
