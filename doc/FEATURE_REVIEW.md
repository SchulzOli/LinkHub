#### 1.2 Lokaler Favicon-Cache statt Live-Lookup

- Favicon beim Anlegen einmal laden, als Blob in `image_assets` / `image_blobs` ablegen, `faviconOverrideImageId` analog zum Upload nutzen.
- Fallback-Kette: `https://<host>/favicon.ico` → Google-Service → Platzhalter-Initial-Chip.
- Opt-out-Schalter „Favicons offline-only" in den Optionen, der den Google-Call komplett deaktiviert.

**Warum P1**: entschärft die Datenschutz-Aussage im README, spart Netz-Traffic, verbessert Offline-Verhalten (Extension öffnet oft ohne Netz).

#### 2.2 Notizen-/Sticky-Node-Typ

- Neuer Node-Typ `stickyNode` neben `linkCard` und `pictureNode`.
- Markdown- oder Plaintext-Inhalt, eigene Größen- und Farb-Controls, gleiche Snap-/Select-/Copy-Mechanik.
- Für Context auf dem Canvas (Projekt-Beschreibungen, Quelle eines Link-Clusters).

#### 2.6 Auto-Backup ins lokale Dateisystem

- File System Access API (Chromium + Edge; Firefox: Download-Fallback).
- Einstellbarer Zielordner, Rotations-Schema (z. B. letzte 7 Tage + letzte 4 Wochen).
- Ereignis-basiertes Backup nach Workspace-Mutation, debounced auf z. B. 60 s.

#### 2.7 Erweiterte Analytics-Sichten

- Heatmap (365 Tage) analog GitHub-Contributions für Link-Öffnungen gesamt.

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
