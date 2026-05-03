

export function neverReached(value: never): never {
  throw new Error(`This code should never be reached, value: ${value}`)
}

export type PartialRecord<K extends string, V> = Partial<Record<K, V>>;
export const getRecordValues = Object.values as <V>(record: PartialRecord<any, V>) => V[];
export const getRecordKeys = Object.keys as <K extends string>(record: PartialRecord<K, any>) => K[];