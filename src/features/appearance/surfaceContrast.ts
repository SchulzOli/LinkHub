const darkSurfaceColorCache = new Map<string, boolean>()

type ParsedColor = {
  r: number
  g: number
  b: number
  a: number
}

function clampChannel(channel: number) {
  return Math.max(0, Math.min(255, channel))
}

function clampAlpha(alpha: number) {
  return Math.max(0, Math.min(1, alpha))
}

function parseHexColor(color: string): ParsedColor | null {
  const normalized = color.trim().toLowerCase().replace('#', '')

  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(normalized)) {
    return null
  }

  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((channel) => `${channel}${channel}`)
          .join('')
      : normalized

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
    a: 1,
  }
}

function parseRgbColor(color: string): ParsedColor | null {
  const match = color
    .trim()
    .match(
      /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*(?:,\s*(\d+(?:\.\d+)?)\s*)?\)$/i,
    )

  if (!match) {
    return null
  }

  return {
    r: clampChannel(Number(match[1])),
    g: clampChannel(Number(match[2])),
    b: clampChannel(Number(match[3])),
    a: match[4] === undefined ? 1 : clampAlpha(Number(match[4])),
  }
}

function parseColor(color: string) {
  return parseHexColor(color) ?? parseRgbColor(color)
}

function formatRgbColor(color: ParsedColor) {
  return `rgb(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)})`
}

function formatRgbaColor(color: ParsedColor) {
  const alpha = Number(clampAlpha(color.a).toFixed(4))

  if (alpha >= 0.9999) {
    return formatRgbColor(color)
  }

  return `rgba(${Math.round(color.r)}, ${Math.round(color.g)}, ${Math.round(color.b)}, ${alpha})`
}

function compositeColor(
  foreground: ParsedColor,
  background: ParsedColor,
): ParsedColor {
  const foregroundAlpha = clampAlpha(foreground.a)
  const backgroundAlpha = clampAlpha(background.a)
  const alpha = foregroundAlpha + backgroundAlpha * (1 - foregroundAlpha)

  if (alpha <= 0) {
    return { r: 0, g: 0, b: 0, a: 0 }
  }

  const compositeChannel = (
    foregroundChannel: number,
    backgroundChannel: number,
  ) =>
    (foregroundChannel * foregroundAlpha +
      backgroundChannel * backgroundAlpha * (1 - foregroundAlpha)) /
    alpha

  return {
    r: compositeChannel(foreground.r, background.r),
    g: compositeChannel(foreground.g, background.g),
    b: compositeChannel(foreground.b, background.b),
    a: alpha,
  }
}

function resolveColor(
  color: string,
  backdropColor?: string,
): ParsedColor | null {
  const parsedColor = parseColor(color)

  if (!parsedColor) {
    return null
  }

  if (parsedColor.a >= 1 || !backdropColor) {
    return parsedColor
  }

  const resolvedBackdropColor = resolveColor(backdropColor)

  if (!resolvedBackdropColor) {
    return parsedColor
  }

  return compositeColor(parsedColor, resolvedBackdropColor)
}

function toLinearChannel(channel: number) {
  const normalized = channel / 255

  if (normalized <= 0.04045) {
    return normalized / 12.92
  }

  return ((normalized + 0.055) / 1.055) ** 2.4
}

export function applyColorOpacity(color: string, opacity: number) {
  const parsedColor = parseColor(color)

  if (!parsedColor) {
    return color
  }

  return formatRgbaColor({
    ...parsedColor,
    a: clampAlpha(parsedColor.a * Math.max(0, opacity)),
  })
}

export function getRelativeLuminance(color: string, backdropColor?: string) {
  const resolvedColor = resolveColor(color, backdropColor)

  if (!resolvedColor) {
    return null
  }

  return (
    0.2126 * toLinearChannel(resolvedColor.r) +
    0.7152 * toLinearChannel(resolvedColor.g) +
    0.0722 * toLinearChannel(resolvedColor.b)
  )
}

type ContrastRatioArgs = {
  foregroundColor: string
  backgroundColor: string
  backgroundBackdropColor?: string
}

export function getContrastRatio({
  foregroundColor,
  backgroundColor,
  backgroundBackdropColor,
}: ContrastRatioArgs) {
  const resolvedBackgroundColor = resolveColor(
    backgroundColor,
    backgroundBackdropColor,
  )

  if (!resolvedBackgroundColor) {
    return null
  }

  const resolvedForegroundColor = resolveColor(
    foregroundColor,
    formatRgbColor(resolvedBackgroundColor),
  )

  if (!resolvedForegroundColor) {
    return null
  }

  const foregroundLuminance =
    0.2126 * toLinearChannel(resolvedForegroundColor.r) +
    0.7152 * toLinearChannel(resolvedForegroundColor.g) +
    0.0722 * toLinearChannel(resolvedForegroundColor.b)
  const backgroundLuminance =
    0.2126 * toLinearChannel(resolvedBackgroundColor.r) +
    0.7152 * toLinearChannel(resolvedBackgroundColor.g) +
    0.0722 * toLinearChannel(resolvedBackgroundColor.b)
  const lighterLuminance = Math.max(foregroundLuminance, backgroundLuminance)
  const darkerLuminance = Math.min(foregroundLuminance, backgroundLuminance)

  return (lighterLuminance + 0.05) / (darkerLuminance + 0.05)
}

type ReadableTextColorArgs = {
  backgroundColor: string
  backgroundBackdropColor?: string
  lightTextColor: string
  darkTextColor: string
}

export function getReadableTextColor({
  backgroundColor,
  backgroundBackdropColor,
  lightTextColor,
  darkTextColor,
}: ReadableTextColorArgs) {
  const lightTextContrast = getContrastRatio({
    foregroundColor: lightTextColor,
    backgroundColor,
    backgroundBackdropColor,
  })
  const darkTextContrast = getContrastRatio({
    foregroundColor: darkTextColor,
    backgroundColor,
    backgroundBackdropColor,
  })

  if (lightTextContrast === null && darkTextContrast === null) {
    return darkTextColor
  }

  if (lightTextContrast === null) {
    return darkTextColor
  }

  if (darkTextContrast === null) {
    return lightTextColor
  }

  return lightTextContrast >= darkTextContrast ? lightTextColor : darkTextColor
}

export function isDarkSurfaceColor(color: string) {
  const normalizedColor = color.trim().toLowerCase()
  const cachedResult = darkSurfaceColorCache.get(normalizedColor)

  if (cachedResult !== undefined) {
    return cachedResult
  }

  const luminance = getRelativeLuminance(normalizedColor)

  if (luminance === null) {
    darkSurfaceColorCache.set(normalizedColor, false)
    return false
  }

  const isDark = luminance < 0.36
  darkSurfaceColorCache.set(normalizedColor, isDark)
  return isDark
}
