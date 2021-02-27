import { OptsType, exponential } from './exponential'

import timeout from 'timeout-then'

export async function backoff<T>(
  delays: Iterator<number, void, void>,
  task: () => Promise<T>,
): Promise<T> {
  let delay: number | undefined
  let taskStart = Date.now()

  while (true) {
    try {
      if (delay != null) await timeout(delay)
      taskStart = Date.now()
      return await task()
    } catch (err) {
      const result = delays.next()
      if (result.done) throw err
      const taskDuration = Date.now() - taskStart
      delay = Math.max(result.value - taskDuration, 0)
    }
  }
}

export async function exponentialBackoff<T>(
  opts: OptsType,
  task: () => Promise<T>,
) {
  return backoff(exponential(opts), task)
}
