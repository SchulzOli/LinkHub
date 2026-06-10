# Freehand Drawing – Design Sketch

Status: Draft · v0.1 · June 2026  
Ziel: Excalidraw-ähnliches Freihand-Zeichnen auf dem unendlichen Canvas

---

## 1. Motivation

LinkHub organisiert visuelle Informationen – Bookmarks, Bilder, Gruppen.  
Eine einfache Zeichenebene erlaubt es, Beziehungen zu markieren, 
Bereiche hervorzuheben oder Annotationen direkt auf dem Canvas zu hinterlassen.  
Der Fokus liegt auf **freihändigen Strichen**, nicht auf einem vollständigen 
Zeichenprogramm.

---

## 2. Abgrenzung: Was das Feature *nicht* ist

| Nicht enthalten | Begründung |
|---|---|
| Formen (Rechteck, Ellipse, Pfeil, Linie) | Erfordert Shape-Erkennung + Resize-Handles – eigener Node-Typ |
| Text-auf-Canvas | Überschneidet sich mit Sticky-Notes (Feature 2.2) |
| Ebenen / Layer-Verwaltung | Zu komplex für MVP – Striche liegen immer über Cards/Groups |
| Radierer (freihändig) | Stattdessen: Stroke-Select + Delete |
| Druckempfindlichkeit | Nur für PointerEvents mit `pressure`-Support – Fallback auf konstante Breite |
| Export als Bild | Spaeter via `html-to-image` analog Template-Preview |

---

## 3. Datenmodell

```typescript
// src/contracts/freehandStroke.ts

export const FreehandPointSchema = z.object({
  x: z.number(),       // Canvas-Koordinate relativ zu stroke.positionX/Y
  y: z.number(),
  pressure: z.number().min(0).max(1).optional(),
})

export const FreehandStrokeSchema = z.object({
  id: z.string().min(1),
  positionX: z.number(),       // Canvas-Offset (für Pan-Verschiebung)
  positionY: z.number(),
  points: z.array(FreehandPointSchema).min(1),
  color: z.string(),           // CSS-Farbwert, z. B. "#a8a5ff"
  width: z.number().positive(),// in Canvas-Einheiten (px bei zoom=1)
  opacity: z.number().min(0).max(1),
  smoothing: z.boolean().optional(),        // true = Catmull-Rom-Interpolation
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type FreehandPoint = z.infer<typeof FreehandPointSchema>
export type FreehandStroke = z.infer<typeof FreehandStrokeSchema>
```

Der Stroke liegt in Canvas-Koordinaten, nicht in Screen-Koordinaten.  
Das bedeutet: Panning ändert `positionX/Y` nicht; nur explizites Verschieben 
eines ausgewählten Strokes ändert den Offset.  
Die `points` sind relativ zu `positionX/Y`, sodass ein Stroke über 
`positionX/Y` verschoben werden kann, ohne die Punktdaten zu verändern.

---

## 4. Workspace-Integration

### Schema-Erweiterung

```typescript
// src/contracts/workspace.ts
strokes: z.array(FreehandStrokeSchema),
// LATEST_WORKSPACE_SCHEMA_VERSION → 2
```

### State-Slice

Neuer Selector + Aktionen in `WorkspaceDataState`:

```typescript
strokes: FreehandStroke[]
addStroke: (stroke: FreehandStroke) => void
addStrokes: (strokes: FreehandStroke[]) => void
updateStroke: (strokeId: string, updates: Partial<FreehandStroke>) => void
removeStroke: (strokeId: string) => void
removeStrokes: (strokeIds: string[]) => void
moveStroke: (strokeId: string, position: { x: number; y: number }) => void
```

### Selektions-State

```typescript
selectedStrokeIds: string[]
// plus toggle/clear/set in WorkspaceSelectionState
```

### InteractionMode

```typescript
// src/state/workspaceStoreTypes.ts
export type InteractionMode = 'edit' | 'view' | 'draw'
```

- `'draw'` deaktiviert Card-Drag, aktiviert Zeichen-Stift
- Taskbar zeigt Farb-/Breiten-Controls statt Quick-Add
- Rechte Maustaste = Pan wie in edit/view

---

## 5. Zeichnen: Interaktions-Hook

```typescript
// src/components/canvas/hooks/useFreehandDraw.ts
```

### Pointer-Event-Flow

1. **`pointerdown`** (linke Taste, auf Canvas-Hintergrund):
   - Neuen `FreehandStroke` anlegen mit leerem `points[]`
   - Ersten Point hinzufügen (Canvas-Koordinaten via `screenPointToCanvas`)
   - Stroke in den Store schreiben (wird gerendert)

2. **`pointermove`** (rAF-gepuffert):
   - Alle `pointermove`-Events sammeln
   - Pro Frame: Points ans `points[]` anhängen
   - Stroke im Store updaten → Re-Render

3. **`pointerup`**:
   - Letzten Point setzen
   - Optional: Ramer–Douglas–Peucker-Vereinfachung (Toleranz ~0.5 Canvas-Units)
   - Stroke finalisieren

### Smoothing

Catmull-Rom-Interpolation beim Rendern (nur visuell, nicht im Datenmodell):

```typescript
function interpolateCatmullRom(
  points: FreehandPoint[],
  segmentsPerPoint: number,
): { x: number; y: number }[]
```

Der Stroke speichert weiterhin die rohen Pointer-Punkte; das Rendering 
interpoliert bei `smoothing === true`.

### Dedup / Simplification

Ramer–Douglas–Peucker nach `pointerup`:

```typescript
function simplifyPoints(
  points: FreehandPoint[],
  tolerance: number,
): FreehandPoint[]
```

Reduziert die Point-Anzahl um typischerweise 40–70 %, was Speicher 
(IndexedDB) und Render-Zeit spart.

---

## 6. Canvas-Rendering

### SVG-Layer im InfiniteCanvas

```tsx
// Innerhalb von InfiniteCanvas.tsx
{visibleStrokes.map((stroke) => (
  <svg
    key={stroke.id}
    style={{
      position: 'absolute',
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      transform: `translate(${stroke.positionX * viewport.zoom}px, ${stroke.positionY * viewport.zoom}px) scale(${viewport.zoom})`,
      transformOrigin: 'top left',
    }}
  >
    <path
      d={buildPathData(stroke, viewport.zoom)}
      fill="none"
      stroke={stroke.color}
      strokeWidth={stroke.width}
      strokeOpacity={stroke.opacity}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
))}
```

Alternative: `<canvas>`-Overlay für bessere Performance bei vielen Strichen.  
Für MVP reicht SVG (einfacher, interaktiv, selektierbar).

### Culling

Nur Striche rendern, deren Bounding-Box den sichtbaren Viewport schneidet:

```typescript
function getStrokeBounds(points: FreehandPoint[]): { minX, minY, maxX, maxY }
function isStrokeVisible(stroke, viewportBounds): boolean
```

---

## 7. UI / Toolbar

### In `'draw'`-Mode

Die `BottomTaskbar` zeigt statt Quick-Add:

- **Farbwähler** – vorhandene `ColorPresetPicker`-Komponente (via `useAppearanceStore`-Paletten)
- **Breiten-Slider** – 1–20 Canvas-Units, Default 4
- **Deckkraft-Slider** – 0,1–1,0, Default 0,85
- **Smoothing-Toggle** – Catmull-Rom an/aus
- **Modus-Toggle** – draw / edit (Icon: Stift / Hand)

### Selektion im Draw-Mode

- Klick auf einen Stroke selektiert ihn (stroke-id via `data-entity-id`)
- Ausgewählte Striche zeigen Bounding-Box mit Resize-Handles (analog zu Cards)
- `Delete`-Taste löscht selektierte Striche
- Move via Drag (analog zu Card-Drag, aber ohne Snap-to-Grid)

---

## 8. Speicher & Migration

### IndexedDB

`strokes[]` werden als Teil des Workspace-Dokuments in `workspace_records` 
gespeichert. Kein separater Object Store nötig.

### Schema-Migration

```typescript
// src/storage/storageMigrations.ts
function migrateV1toV2(workspace: WorkspaceV1): WorkspaceV2 {
  return {
    ...workspace,
    schemaVersion: 2,
    strokes: [],
  }
}
```

---

## 9. Implementierungs-Reihenfolge

| Schritt | Beschreibung | Aufwand |
|---------|-------------|---------|
| 1 | `FreehandStroke`-Schema + Typen | 30 min |
| 2 | Workspace-Schema erweitern, Migration v1→v2 | 1 h |
| 3 | State-Slice (CRUD + Selection) | 1 h |
| 4 | `InteractionMode` um `'draw'` erweitern, Mode-Toggle in Taskbar | 1 h |
| 5 | `useFreehandDraw`-Hook (Pointer-Events, Smoothing, Simplification) | 4 h |
| 6 | SVG-Rendering in `InfiniteCanvas` + Culling | 3 h |
| 7 | Stroke-Selektion + Löschen | 2 h |
| 8 | Stroke-Verschieben (Drag) | 2 h |
| 9 | Farb-/Breiten-/Deckkraft-UI in Taskbar | 2 h |
| 10 | Tests (Unit + E2E) | 3 h |

**Gesamt: ~18–20 h (2,5 Tage)**

---

## 10. Offene Fragen

- Sollten Striche ober- oder unterhalb von Cards/Groups liegen?  
  Vorschlag: **über** Cards (als Annotationsebene).
- Darf man einen Stroke durch Ziehen an den Punkten verformen?  
  → Nicht im MVP. Nur Verschieben des gesamten Strokes.
- Wie verhält sich der Draw-Mode mit dem Format-Painter?  
  → Format-Painter ist im Draw-Mode deaktiviert.
- Soll der Draw-Mode die Grid-Anzeige abschalten?  
  → Grid bleibt an (Orientierung) – kann aber im Draw-Mode gedimmt werden.
- Sollten Striche vom Export (ZIP-Bundle) erfasst werden?  
  → Ja, als Teil des Workspace-JSON.
