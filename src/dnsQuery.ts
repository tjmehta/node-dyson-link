///<reference path="../@types/multicast-dns/index.d.ts" />

import createMDNS, { QueryType, ResponseType } from 'multicast-dns'

import BaseError from 'baseerr'
import timeout from 'timeout-then'

class DNSQueryError extends BaseError<{}> {}
class DNSQueryTimedOutError extends BaseError<{}> {}

export async function dnsQuery(host: string): Promise<string> {
  const mdns = createMDNS({ loopback: true })
  const timer = timeout(3 * 1000)

  try {
    return await Promise.race<string>([
      timer.then(() => {
        throw new DNSQueryTimedOutError('timedout')
      }) as Promise<never>,
      new Promise<string>((resolve, reject) => {
        const query = {
          questions: [
            {
              name: host,
              type: 'A',
            },
          ],
        }
        mdns.on('response', (res: ResponseType) => {
          const answer = res.answers.find(
            (answer) => answer.name === query.questions[0].name,
          )
          if (answer == null) return
          resolve(answer.data)
        })
        mdns.query(query, (err?: Error) => {
          if (err == null) return
          reject(DNSQueryError.wrap(err, 'send error'))
        })
      }),
    ])
  } finally {
    timer.clear()
    mdns.destroy()
  }
}
