

export function neverReached(value: never): never {
  throw new Error(`This code should never be reached, value: ${value}`)
}