declare module 'multicast-dns' {
  export type AnswerType = {
    name: string
    data: string
  }

  export type ResponseType = {
    answers: Array<AnswerType>
  }

  export type QueryType = { questions: { name: string; type: string } }

  const mdns: {
    query: (query: QueryType, cb: (err?: Error) => unknown) => void
    on: (event: string, cb: (res: ResponseType) => unknown) => void
  }

  const createMDNS: (opts: { loopback: boolean }) => mdns

  export default createMDNS
}
