14. **Inline-SVG-Icons** sind überall dupliziert (Taskbar, Rail-Pin, Chevron). Extrahieren nach `src/components/ui/icons/` mit einheitlicher API (`<Icon name="chevron-down" size={16} />`). Reduziert LOC und sichert konsistente `stroke-width`/`viewBox`.
15. **CSS-Module-Konventionen**. Beobachtet: `modeButton`, `modeSvg`, `modeSvgLarge`, `modeIcon` – zu viele Varianten ohne klare Semantik. Vorschlag: BEM-ähnliche Benennung (`iconButton`, `iconButton--lg`, `iconButton--primary`) oder `data-size="sm|md|lg"` Attribute.
16. **Inline-Styles via `style`-Prop in `LinkCard`**. `editPanelStyle`, `urlTooltipStyle`, `--card-translate-x` etc. sind technisch nötig (Portal-Positionierung), aber mind. dokumentieren, welche Custom-Properties offizielles Interface sind. `CardStyleContract.md` oder JSDoc an `LinkCard`.
17. **ID-Kollisionen vermeiden**: `useId()` wird in `BottomTaskbar` genutzt – gut. In anderen Dialog-Komponenten prüfen, ob statische IDs verwendet werden (häufige Bug-Quelle bei mehrfacher Mount-Instanz).
18. **Theming-Layer vs. CSS-Variablen**. Der Store (`useAppearanceStore`) schreibt vermutlich Variablen ins `:root`. Aktuelle Tokens in `tokens.css` sind aber hartcodiert. Klärung: Welche Tokens sind user-editierbar, welche sind System? In `tokens.css` mit Kommentar-Blöcken trennen.

### P3 – Details & Politur

19. **Card-Hover** nutzt `--card-hover-offset: -2px` via CSS-Transition auf Custom-Property. Safari < 16.4 unterstützt `@property` für animierbare CPs nicht immer zuverlässig. Fallback: `transform: translateY(-2px)` auf innerem Element.
20. **Selection-Marquee**-Animation (120 ms, scale 0.985 → 1) ist angenehm dezent. Für schnelles Mehrfach-Drag reicht aktuell die Animation – ok.
21. **`backdrop-filter: blur(18px)`** hat messbare Kosten, insbesondere bei vielen Cards + Rail gleichzeitig sichtbar. Messung per DevTools empfehlenswert; ggf. auf `blur(12px)` reduzieren.
22. **Checkbox-Styling** ist aufwändig (Custom-Clip-Path-Haken) – schön, aber viel Spezial-CSS. Prüfen, ob zentraler `<Checkbox>`-Component dies kapselt.
23. **Konsistenz der Radius-Skala**. `tokens.css` definiert `--radius-sm/md/lg`. In Modulen tauchen Ableitungen auf: `calc(var(--radius-lg) + 0.1rem)`, `calc(var(--radius-lg) + 0.7rem)`. Besser `--radius-xl`/`--radius-2xl` ergänzen statt Ad-hoc-Berechnungen.
24. **Privacy-/Store-Assets** (`public/privacy/`, `extension/store-assets/`) sollten visuelle Sprache der App spiegeln – separat reviewen.

---

## 3. Konkreter Umsetzungsvorschlag (Reihenfolge)

| #   | Schritt                                                           | Effort | Impact            |
| --- | ----------------------------------------------------------------- | ------ | ----------------- |
| 1   | Token-Erweiterung (Spacing, Motion, Z-Index, Elevation)           | S      | Hoch              |
| 2   | Focus-Visible-Utility + globale `prefers-reduced-motion`          | S      | Hoch              |
| 3   | Icon-Komponente + Migration aller Inline-SVGs                     | M      | Mittel            |
| 4   | Text-Muted-Kontrast + Touch-Target-Fixes                          | S      | Hoch (A11y)       |
| 5   | Light-Theme-Tokens vervollständigen oder `color-scheme` entfernen | S      | Mittel            |
| 6   | Empty-Canvas-Guide CTA + Illustration                             | M      | Hoch (Onboarding) |
| 7   | LinkCard-Edit-Panel in Tabs/Sections gliedern                     | M      | Mittel            |
| 8   | Edit-Mode-Overlay reduzieren                                      | S      | Mittel            |
| 9   | Mobile-Layout Rail-Toggle + Taskbar                               | M      | Mittel            |
| 10  | Radius-Skala erweitern, Ad-hoc-`calc`s ersetzen                   | S      | Niedrig           |

Aufwand: **S** ≤ 0.5 Tag, **M** 0.5–2 Tage.

---

## 4. Beispielhafte Token-Erweiterung (Snippet)

```css
:root {
  /* Spacing (4px base) */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-8: 3rem;

  /* Typography */
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-md: 1rem;
  --font-size-lg: 1.125rem;
  --line-height-tight: 1.2;
  --line-height-normal: 1.5;

  /* Motion */
  --motion-fast: 120ms;
  --motion-base: 160ms;
  --motion-slow: 240ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);

  /* Elevation */
  --shadow-1: 0 1px 2px rgba(0, 0, 0, 0.18);
  --shadow-2: 0 6px 14px rgba(0, 0, 0, 0.32);
  --shadow-3: 0 20px 44px rgba(0, 0, 0, 0.48), 0 4px 10px rgba(0, 0, 0, 0.2);

  /* Z-Index */
  --z-canvas: 1;
  --z-card-hover: 10;
  --z-card-selected: 24;
  --z-overlay: 20;
  --z-taskbar: 30;
  --z-dialog: 40;
  --z-tooltip: 50;
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --motion-fast: 0ms;
    --motion-base: 0ms;
    --motion-slow: 0ms;
  }
}
```

---

## 5. Offene Fragen

- Gibt es ein verbindliches Light-Theme oder ist Dark die offizielle Default-Optik (Light nur via User-Theme)?
- Soll Mobile-Support (Touch-Canvas) offiziell supported werden? Falls ja, Gesten-Layer priorisieren.
- Welche Telemetrie liegt zu Edit-vs-View-Ratio und Quick-Add-Nutzung vor? Beeinflusst Priorisierung der Empty-State- und Taskbar-Überarbeitung.

---

## 6. Nicht abgedeckt (bewusst)

- Performance-Profiling (separate Session sinnvoll: Canvas-Zoom mit > 200 Cards, `backdrop-filter`-Kosten).
- E2E-Test-Snapshots / visuelle Regressions-Absicherung (Playwright).
- Store-/State-Architektur (`useWorkspaceStore`, `useAppearanceStore`).
- Internationalisierung (aktuell englische UI-Strings hartkodiert).
