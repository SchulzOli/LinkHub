# Canvas Engine

The LinkHub canvas has two independent parts:

| Part         | Folder         | Built on                                                                       | Required     |
| ------------ | -------------- | ------------------------------------------------------------------------------ | ------------ |
| Engine       | `src/engine/`  | [grida](https://github.com/gridaco/grida): `@grida/cmath`, `@grida/pixel-grid` | yes          |
| Card effects | `src/effects/` | three.js + [WICG html-in-canvas](https://github.com/WICG/html-in-canvas)       | no, optional |

The engine never imports anything from `src/effects/`. The effects can be
turned off, removed, or fail without changing how the canvas behaves.

## Engine

```
src/engine/
  camera.ts                    Viewport <-> grida cmath affine transform
  grid.ts                      grid options + adaptive step
  react/CanvasEngineSurface    world layer (one CSS matrix) + grid
  react/CanvasGrid             @grida/pixel-grid painter (Canvas 2D)
  react/canvasBackground.ts    "clicked empty canvas" detection
  react/useResolvedCssValue    resolves var(--token) for canvas colors
```

- The world is measured in CSS pixels at zoom 1, with y pointing down.
  `Viewport { x, y, zoom }` is what gets saved.
- Camera transform (grida `cmath.Transform`):
  `[[zoom, 0, -x·zoom], [0, zoom, -y·zoom]]`. Panning uses
  `cmath.transform.translate`. Zooming around the pointer uses
  `cmath.transform.scale` with the pointer as origin.
- Cards, groups and pictures render at world coordinates
  (`translate(positionX, positionY)`). The camera is applied once, as a CSS
  `matrix()` on the world layer.
- The grid is drawn by `@grida/pixel-grid` from the same transform. The step
  doubles when cells would be smaller than 6 px on screen.
- Overlays (edit panels, tooltips, marquee, snap preview) stay in screen
  space.

`src/features/placement/canvasMath.ts` re-exports the camera functions under
their old names.

## Card effects (optional)

Setting: **Options → Appearance → Card effects**. It is stored per device as
`localStorage['linkhub.canvasEffects'] = 'on'`.

The effects only run when all of these are true:

- the setting is on,
- the browser supports html-in-canvas (Chromium with
  `chrome://flags/#canvas-draw-element`),
- `prefers-reduced-motion` is not set.

three.js is only loaded in that case, as a separate `three-vendor` chunk.

How it works:

1. A canvas (`layoutsubtree` + `content="drawable"`) sits above the world
   layer, with `pointer-events: none`.
2. When an effect starts, the card is cloned into that canvas with its
   identity attributes removed. The clone is scaled to its on-screen size
   with CSS `zoom`, then copied into a WebGL texture in the next `paint`
   event, and removed right away.
3. three.js draws the texture with a shader and additive blending on top of
   the real card. The shader uses edge detection, so text and icons light
   up the most.
4. The real card is never moved, hidden or changed, so clicks, focus and
   accessibility are unaffected.

Effects:

- **glint**: a diagonal band of light when the pointer enters a card.
- **appear**: a ripple when a card is newly added. More than 3 cards
  appearing at once (for example when a workspace loads) is ignored.

Limits: at most 6 effects at the same time. The render loop only runs while
an effect is active.

## Roadmap

1. Stop entities re-rendering on pan. They still get `viewport` for zoom
   (shadow scaling and drag math).
2. Replace the zustand undo stack with `@grida/history`.
3. Move snapping onto `cmath` snap helpers. Add `@grida/ruler` as an
   optional overlay.
4. More effects: selection pulse, group hover, and export via
   `captureElementImage`.
