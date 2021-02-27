import SimpleApiClient, { setFetch } from 'simple-api-client'

import BaseError from 'baseerr'
import { DeviceType } from './index'
import fetch from 'node-fetch'
import https from 'https'
import memoizeConcurrent from 'memoize-concurrent'

setFetch(fetch as any)

export class DysonLinkApiClientError extends BaseError<{}> {}

export type AuthType = {
  Account: string
  Password: string
}

export type OptsType = {
  email: string
  password: string
  country: string
  auth?: AuthType
}

export default class DysonLinkApiClient extends SimpleApiClient {
  private readonly email: string
  private readonly password: string
  private readonly country: string
  private auth: AuthType | null = null
  private authHeader: string | null = null

  constructor({ email, password, country, auth }: OptsType) {
    super('https://appapi.cp.dyson.com/', (url, init) => {
      const headers: NonNullable<typeof init>['headers'] =
        init?.json == null
          ? {}
          : { 'content-length': JSON.stringify(init?.json).length.toString() }

      return {
        ...init,
        headers: {
          ...init?.headers,
          ...headers,
          'user-agent': 'DysonLink/29019 CFNetwork/1188 Darwin/20.0.0',
        },
        // @ts-ignore
        insecureHTTPParser: true,
        // @ts-ignore
        agent: new https.Agent({
          // @ts-ignore
          rejectUnauthorized: false,
        }),
      }
    })
    this.email = email
    this.password = password
    this.country = country ?? 'EN'
    if (auth) this.auth = auth
  }

  private getAuthHeader(): string {
    if (this.auth == null) {
      throw new DysonLinkApiClientError(
        'cannot generate auth header when missing auth',
        { auth: this.auth },
      )
    }
    if (this.authHeader != null) return this.authHeader

    const token = Buffer.from(
      `${this.auth.Account}:${this.auth.Password}`,
    ).toString('base64')
    this.authHeader = `Basic ${token}`

    return this.authHeader
  }

  login = memoizeConcurrent(
    async (): Promise<AuthType> => {
      if (this.auth) return this.auth

      return await this.post('v1/userregistration/authenticate', 200, {
        query: {
          country: this.country,
        },
        json: {
          Email: this.email,
          Password: this.password,
        },
      })
    },
  )

  getDevices = memoizeConcurrent(
    async (): Promise<Array<DeviceType>> => {
      await this.login()

      return await this.get('v2/provisioningservice/manifest', 200, {
        headers: {
          Authorization: this.getAuthHeader(),
        },
      })
    },
  )
}
