# Offene Ideen

Was aus dem Feature-Review noch offen ist. Erledigt und daher entfernt:
lokaler Favicon-Cache, Notiz-Node, Ende-zu-Ende-Sync (Linkhaven-Server und
WebDAV), PWA mit Offline-Shell.

### P2

#### Auto-Backup ins lokale Dateisystem

- File System Access API (Chromium + Edge; Firefox: Download-Fallback).
- Einstellbarer Zielordner, Rotations-Schema (z. B. letzte 7 Tage + letzte 4 Wochen).
- Ereignis-basiertes Backup nach Workspace-Mutation, debounced auf z. B. 60 s.

#### Erweiterte Analytics-Sichten

- Heatmap (365 Tage) analog GitHub-Contributions für Link-Öffnungen gesamt.

#### Keyboard-Nav / Accessibility

- Tab-Order über Karten in Viewport-Reihenfolge, `Enter` öffnet Link, `F2` rename, `Delete` löscht.
- `role`- und `aria-label`-Audit auf Canvas-Nodes (Screenreader-Nutzung auf unendlichem Canvas ist notorisch schwer, aber zumindest Gruppen-Navigation ist machbar).
- High-Contrast-Theme zusätzlich zu den bestehenden sechs.

### P3

#### Share Target für die Web-App

- `share_target` im Manifest erlaubt „Teilen → Linkhaven" auf Android, sodass eine URL direkt als Karte landet.
