import { useEffect, useRef } from 'react'

import { useResolvedCssValue } from '../engine'
import styles from './CardEffectsLayer.module.css'
import { CardEffectsRenderer } from './CardEffectsRenderer'

const CARD_SELECTOR = '[data-entity-kind="card"]'
const HOVER_COOLDOWN_MS = 700
/** More cards than this appearing at once = workspace load, not a new card. */
const BULK_ADD_THRESHOLD = 3
/** Ignore cards mounted right after the layer starts (initial render). */
const SETTLE_MS = 800

type CardEffectsLayerProps = {
  /** The canvas root that contains the world layer with the cards. */
  rootRef: React.RefObject<HTMLElement | null>
}

/**
 * Optional visual layer: glint on hover and a ripple when a card is added.
 * Never touches the real cards or their interaction; safe to unmount anytime.
 */
export function CardEffectsLayer({ rootRef }: CardEffectsLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<CardEffectsRenderer | null>(null)
  const accent = useResolvedCssValue('var(--accent)')

  useEffect(() => {
    rendererRef.current?.setTint(accent)
  }, [accent])

  useEffect(() => {
    const canvas = canvasRef.current
    const root = rootRef.current
    if (!canvas || !root) {
      return
    }

    let renderer: CardEffectsRenderer
    try {
      renderer = new CardEffectsRenderer(canvas)
    } catch (error) {
      console.warn('[card-effects] disabled: renderer failed', error)
      return
    }
    rendererRef.current = renderer
    renderer.setTint(accent)

    const resize = () => renderer.resize(root.getBoundingClientRect())
    resize()
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(root)

    // Hover glint (event delegation; no listeners on individual cards).
    const lastPlayed = new WeakMap<Element, number>()
    let hoveredCard: Element | null = null
    const handlePointerOver = (event: PointerEvent) => {
      const card = (event.target as Element | null)?.closest<HTMLElement>(
        CARD_SELECTOR,
      )
      if (!card || card === hoveredCard || !root.contains(card)) {
        hoveredCard = card ?? null
        return
      }

      hoveredCard = card
      const now = performance.now()
      if (now - (lastPlayed.get(card) ?? 0) < HOVER_COOLDOWN_MS) {
        return
      }
      lastPlayed.set(card, now)
      renderer.play('glint', card)
    }
    root.addEventListener('pointerover', handlePointerOver)

    // Appear ripple for newly added cards.
    const mountedAt = performance.now()
    const mutationObserver = new MutationObserver((records) => {
      if (performance.now() - mountedAt < SETTLE_MS) {
        return
      }

      const added: HTMLElement[] = []
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) {
            return
          }
          if (node.matches(CARD_SELECTOR)) {
            added.push(node)
          }
          added.push(
            ...Array.from(node.querySelectorAll<HTMLElement>(CARD_SELECTOR)),
          )
        })
      }

      if (added.length === 0 || added.length > BULK_ADD_THRESHOLD) {
        return
      }

      // Wait one frame so the new card has its final layout.
      requestAnimationFrame(() => {
        added.forEach((card) => renderer.play('appear', card))
      })
    })
    mutationObserver.observe(root, { childList: true, subtree: true })

    return () => {
      root.removeEventListener('pointerover', handlePointerOver)
      mutationObserver.disconnect()
      resizeObserver.disconnect()
      renderer.dispose()
      rendererRef.current = null
    }
    // accent is applied through setTint; the renderer must not be recreated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootRef])

  // `layoutsubtree` = Chromium's shipped attribute name, `content="drawable"`
  // = current explainer. Both are needed for snapshots across builds.
  const drawableProps = {
    layoutsubtree: '',
    content: 'drawable',
  } as Record<string, string>

  return (
    <canvas
      {...drawableProps}
      ref={canvasRef}
      aria-hidden="true"
      className={styles.layer}
      data-testid="card-effects-layer"
    />
  )
}
