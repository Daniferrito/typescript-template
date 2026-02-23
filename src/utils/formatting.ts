

export function formatTimeShort(timeMs: number): string {
  if (timeMs < 0) {
    return "0s"
  }
  const seconds = Math.floor(timeMs / 1000) % 60
  const minutes = Math.floor(timeMs / (1000 * 60)) % 60
  const hours = Math.floor(timeMs / (1000 * 60 * 60)) % 24
  const days = Math.floor(timeMs / (1000 * 60 * 60 * 24))
  if (days > 0) {
    return `${days}d`
  } else if (hours > 0) {
    return `${hours}h`
  } else if (minutes > 0) {
    return `${minutes}m`
  } else {
    return `${seconds}s`
  }
}