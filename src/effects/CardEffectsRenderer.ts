import {
  AdditiveBlending,
  Color,
  DoubleSide,
  ExternalTexture,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three'

/**
 * Optional card effects: html-in-canvas snapshots of cards rendered by
 * three.js as additive light effects on top of the real (untouched) DOM.
 *
 * The engine never depends on this. A card is cloned into the effects
 * canvas for exactly one paint, uploaded into a texture, and the clone is
 * removed again; the effect then animates from the texture alone.
 */

export type CardEffectKind = 'glint' | 'appear'

type TexElementGL = WebGL2RenderingContext & {
  texElementSubImage2D?: (
    target: number,
    level: number,
    xoffset: number,
    yoffset: number,
    element: Element,
    config?: { width?: number; height?: number },
  ) => void
  texElementImage2D?: (
    target: number,
    level: number,
    internalformat: number,
    format: number,
    type: number,
    element: Element,
  ) => void
}

type PendingEffect = {
  kind: CardEffectKind
  card: HTMLElement
  clone: HTMLElement
  width: number
  height: number
  requestedAt: number
}

type ActiveEffect = {
  kind: CardEffectKind
  card: HTMLElement
  mesh: Mesh<PlaneGeometry, ShaderMaterial>
  texture: ExternalTexture
  glTexture: WebGLTexture
  startedAt: number
  duration: number
}

const MAX_ACTIVE_EFFECTS = 6
const SNAPSHOT_TIMEOUT_MS = 500
const DURATION_MS: Record<CardEffectKind, number> = {
  glint: 900,
  appear: 1100,
}

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// vUv.y = 0 is the top edge of the card (y-down camera, no upload flip).
const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform vec2 uTexel;
  uniform float uTime;   // 0..1
  uniform float uKind;   // 0 = glint, 1 = appear
  uniform vec3 uTint;
  varying vec2 vUv;

  float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

  void main() {
    vec4 tex = texture2D(uMap, vUv);
    if (tex.a < 0.01) discard;

    // Edge strength highlights text, icons and borders.
    float lx = luma(texture2D(uMap, vUv + vec2(uTexel.x, 0.0)).rgb)
             - luma(texture2D(uMap, vUv - vec2(uTexel.x, 0.0)).rgb);
    float ly = luma(texture2D(uMap, vUv + vec2(0.0, uTexel.y)).rgb)
             - luma(texture2D(uMap, vUv - vec2(0.0, uTexel.y)).rgb);
    float edge = clamp(length(vec2(lx, ly)) * 4.0, 0.0, 1.0);

    float intensity;
    if (uKind < 0.5) {
      float diagonal = (vUv.x + vUv.y) * 0.5;
      float position = mix(-0.25, 1.25, uTime);
      float band = exp(-pow((diagonal - position) / 0.07, 2.0));
      intensity = band * (0.16 + 0.84 * edge) * sin(uTime * 3.14159);
    } else {
      float dist = length(vUv - 0.5) * 1.414;
      float ring = exp(-pow((dist - uTime * 1.25) / 0.11, 2.0));
      intensity = (ring * (0.3 + 0.7 * edge) + edge * 0.3) * (1.0 - uTime);
    }

    vec3 color = mix(vec3(1.0), uTint, 0.45) * intensity * tex.a;
    gl_FragColor = vec4(color, intensity * tex.a);
  }
`

function stripCloneIdentity(clone: HTMLElement) {
  const nodes = [clone, ...Array.from(clone.querySelectorAll<HTMLElement>('*'))]
  for (const node of nodes) {
    node.removeAttribute('id')
    node.removeAttribute('data-testid')
    node.removeAttribute('data-entity-kind')
    node.removeAttribute('data-entity-id')
  }
  clone.setAttribute('aria-hidden', 'true')
  clone.setAttribute('inert', '')
}

export class CardEffectsRenderer {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new OrthographicCamera(0, 1, 0, 1, -10, 10)
  private readonly pending = new Map<HTMLElement, PendingEffect>()
  private readonly active = new Map<HTMLElement, ActiveEffect>()
  private readonly geometry = new PlaneGeometry(1, 1)
  private tint = new Color('#a8a5ff')
  private frame: number | null = null
  private disposed = false
  private hostRect = new DOMRect()
  private readonly handlePaint = () => this.uploadPending()
  private readonly canvas: HTMLCanvasElement & { requestPaint?: () => void }

  constructor(canvas: HTMLCanvasElement & { requestPaint?: () => void }) {
    this.canvas = canvas
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
    })
    this.renderer.setClearColor(0x000000, 0)
    canvas.addEventListener('paint', this.handlePaint)
  }

  private get gl() {
    return this.renderer.getContext() as TexElementGL
  }

  setTint(color: string) {
    try {
      this.tint = new Color(color)
    } catch {
      // Keep the previous tint for unparsable colors.
    }
  }

  resize(rect: DOMRect) {
    this.hostRect = rect
    this.renderer.setPixelRatio(window.devicePixelRatio || 1)
    this.renderer.setSize(rect.width, rect.height, false)
    // y-down screen space in CSS px.
    this.camera.left = 0
    this.camera.right = Math.max(1, rect.width)
    this.camera.top = 0
    this.camera.bottom = Math.max(1, rect.height)
    this.camera.updateProjectionMatrix()
  }

  get activeCount() {
    return this.active.size + this.pending.size
  }

  /** Queues an effect; the card is snapshotted on the next paint. */
  play(kind: CardEffectKind, card: HTMLElement) {
    if (this.disposed || this.pending.has(card)) {
      return
    }

    this.stop(card)
    if (this.activeCount >= MAX_ACTIVE_EFFECTS) {
      return
    }

    const rect = card.getBoundingClientRect()
    if (rect.width < 4 || rect.height < 4 || card.offsetWidth === 0) {
      return
    }

    const clone = card.cloneNode(true) as HTMLElement
    stripCloneIdentity(clone)
    // Snapshot at on-screen size so text stays sharp at any zoom.
    clone.style.transform = 'none'
    clone.style.position = 'absolute'
    clone.style.left = '0'
    clone.style.top = '0'
    clone.style.zoom = String(rect.width / card.offsetWidth)
    clone.setAttribute('drawable', '')
    this.canvas.appendChild(clone)

    const pixelRatio = window.devicePixelRatio || 1
    this.pending.set(card, {
      kind,
      card,
      clone,
      width: Math.max(1, Math.round(rect.width * pixelRatio)),
      height: Math.max(1, Math.round(rect.height * pixelRatio)),
      requestedAt: performance.now(),
    })
    this.canvas.requestPaint?.()
    this.schedule()
  }

  stop(card: HTMLElement) {
    const pending = this.pending.get(card)
    if (pending) {
      pending.clone.remove()
      this.pending.delete(card)
    }

    const effect = this.active.get(card)
    if (effect) {
      this.scene.remove(effect.mesh)
      effect.mesh.material.dispose()
      effect.texture.dispose()
      this.gl.deleteTexture(effect.glTexture)
      this.active.delete(card)
    }
  }

  dispose() {
    this.disposed = true
    if (this.frame !== null) {
      cancelAnimationFrame(this.frame)
    }
    this.canvas.removeEventListener('paint', this.handlePaint)
    for (const card of [...this.pending.keys(), ...this.active.keys()]) {
      this.stop(card)
    }
    this.geometry.dispose()
    this.renderer.dispose()
  }

  private uploadPending() {
    if (this.pending.size === 0) {
      return
    }

    const gl = this.gl
    const now = performance.now()

    for (const [card, item] of this.pending) {
      const glTexture = gl.createTexture()
      if (!glTexture) {
        continue
      }

      gl.bindTexture(gl.TEXTURE_2D, glTexture)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)

      try {
        if (typeof gl.texElementSubImage2D === 'function') {
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            item.width,
            item.height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null,
          )
          gl.texElementSubImage2D(gl.TEXTURE_2D, 0, 0, 0, item.clone, {
            width: item.width,
            height: item.height,
          })
        } else {
          gl.texElementImage2D?.(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            item.clone,
          )
        }
      } catch {
        // No snapshot yet; retry on the next paint until the timeout.
        gl.deleteTexture(glTexture)
        continue
      }

      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

      const texture = new ExternalTexture(glTexture)
      const material = new ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
        uniforms: {
          uMap: { value: texture },
          uTexel: { value: [1 / item.width, 1 / item.height] },
          uTime: { value: 0 },
          uKind: { value: item.kind === 'glint' ? 0 : 1 },
          uTint: { value: this.tint },
        },
      })
      const mesh = new Mesh(this.geometry, material)
      mesh.frustumCulled = false
      this.scene.add(mesh)

      this.active.set(card, {
        kind: item.kind,
        card,
        mesh,
        texture,
        glTexture,
        startedAt: now,
        duration: DURATION_MS[item.kind],
      })

      // The texture holds the pixels now; the clone is no longer needed.
      item.clone.remove()
      this.pending.delete(card)
    }

    gl.bindTexture(gl.TEXTURE_2D, null)
    this.renderer.resetState()
    this.schedule()
  }

  private schedule() {
    if (this.frame === null && !this.disposed) {
      this.frame = requestAnimationFrame(this.tick)
    }
  }

  private readonly tick = (now: number) => {
    this.frame = null

    for (const [card, item] of this.pending) {
      if (now - item.requestedAt > SNAPSHOT_TIMEOUT_MS || !card.isConnected) {
        this.stop(card)
      }
    }

    for (const [card, effect] of this.active) {
      const progress = (now - effect.startedAt) / effect.duration
      if (progress >= 1 || !card.isConnected) {
        this.stop(card)
        continue
      }

      // Follow the real card (pan/zoom/drag) every frame.
      const rect = card.getBoundingClientRect()
      effect.mesh.position.set(
        rect.left - this.hostRect.left + rect.width / 2,
        rect.top - this.hostRect.top + rect.height / 2,
        0,
      )
      effect.mesh.scale.set(rect.width, rect.height, 1)
      effect.mesh.material.uniforms.uTime.value = Math.max(0, progress)
    }

    this.renderer.render(this.scene, this.camera)

    if (this.activeCount > 0) {
      this.schedule()
    }
  }
}
