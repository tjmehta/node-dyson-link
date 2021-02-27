export type OptsType = {
  base?: number
  factor?: number
  min?: number
  max?: number
  count?: number
}

export function* exponential(opts: OptsType): Generator<number, void, void> {
  const { base, min: minVal, max: maxVal, count: maxCount, factor } = {
    base: 1000,
    min: 0,
    max: Infinity,
    count: Infinity,
    factor: 2,
    ...opts,
  }
  let count = 0

  while (maxCount > count) {
    yield Math.max(Math.min(base * Math.pow(factor, count), maxVal), minVal)
    count++
  }
}
