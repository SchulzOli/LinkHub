export function hexToRgb(value: string) {
  const normalized = value.trim().replace('#', '')

  if (normalized.length !== 3 && normalized.length !== 6) {
    return null
  }

  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((part) => `${part}${part}`)
          .join('')
      : normalized

  const parsed = Number.parseInt(expanded, 16)

  if (Number.isNaN(parsed)) {
    return null
  }

  return {
    red: (parsed >> 16) & 255,
    green: (parsed >> 8) & 255,
    blue: parsed & 255,
  }
}

export function withAlpha(color: string, alpha: number) {
  const rgb = hexToRgb(color)

  if (!rgb) {
    return color
  }

  const clampedAlpha = Math.max(0, Math.min(1, alpha))
  return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${clampedAlpha})`
}

export function mixHexColors(left: string, right: string, ratio: number) {
  const leftRgb = hexToRgb(left)
  const rightRgb = hexToRgb(right)

  if (!leftRgb || !rightRgb) {
    return left
  }

  const weight = Math.max(0, Math.min(1, ratio))
  const mixChannel = (leftChannel: number, rightChannel: number) =>
    Math.round(leftChannel * (1 - weight) + rightChannel * weight)

  return `rgb(${mixChannel(leftRgb.red, rightRgb.red)}, ${mixChannel(
    leftRgb.green,
    rightRgb.green,
  )}, ${mixChannel(leftRgb.blue, rightRgb.blue)})`
}
