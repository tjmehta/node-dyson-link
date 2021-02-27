import mqtt, { MqttClient, Packet } from 'mqtt'

import AbstractStartable from 'abstract-startable'
import BaseError from 'baseerr'
import crypto from 'crypto'
import { dnsQuery } from './dnsQuery'
import { exponentialBackoff } from './backoff'

class DysonDeviceClientError extends BaseError<{}> {}

enum MessageMsgType {
  ENVIRONMENTAL_CURRENT_SENSOR_DATA = 'ENVIRONMENTAL-CURRENT-SENSOR-DATA',
  CURRENT_STATE = 'CURRENT-STATE',
  STATE_CHANGE = 'STATE-CHANGE',
}
type SensorStateMessage = {
  msg: MessageMsgType.ENVIRONMENTAL_CURRENT_SENSOR_DATA
  data: {
    p25r: number // p2.5
    p10r: number // p10
    va10: number // voc density
    noxl: number // nitrogen density
    pact: number // particle characteristic
    vact: number // ??
  }
}
type CurrentStateMessage = {
  msg: MessageMsgType.CURRENT_STATE
}
type StateChangeMessage = {
  msg: MessageMsgType.STATE_CHANGE
}
type MessageType = SensorStateMessage | CurrentStateMessage | StateChangeMessage

export enum ProductType {
  HP02 = '455', // dyson link
  HP04 = '527', // dyson pure hot+cool
}

export enum ConnectionType {
  WSS = 'wss',
}

export type DeviceType = {
  Serial: string
  Name: string
  Version: string
  LocalCredentials: string
  AutoUpdate: boolean
  NewVersionAvailable: boolean
  ProductType: ProductType
  ConnectionType: ConnectionType
}

export default class DysonDeviceClient extends AbstractStartable {
  private opts: DeviceType
  private auth: {
    username: string
    password: string
  }
  private mqtt: MqttClient | null = null
  private TOPICS: {
    STATUS: string
    COMMAND: string
  }

  constructor(opts: DeviceType) {
    super()
    this.opts = opts
    this.auth = {
      username: this.opts.Serial,
      password: decryptCredentials(this.opts.LocalCredentials),
    }
    const topicNamespace = `${this.opts.ProductType}/${this.opts.Serial}`
    this.TOPICS = {
      STATUS: `${topicNamespace}/status/current`,
      COMMAND: `${topicNamespace}/command`,
    }
  }

  async _start() {
    const hostname = `${this.opts.Serial}.local`
    console.log('ip?', hostname)
    const ip = await dnsQuery(hostname)
    console.log('got ip', ip)
    await new Promise<void>((resolve, reject) => {
      const url = `mqtt://${ip}`
      console.log('connect?')
      this.mqtt = mqtt.connect(url, this.auth)
      const handleErr = (err: Error) => {
        cleanup()
        reject(
          DysonDeviceClientError.wrap(err, 'connection error', {
            url,
            auth: this.auth,
          }),
        )
      }
      const handleConnect = () => {
        console.log('connect!!')
        this.mqtt?.on('message', this._handleMessage)
        // TODO: don't subscribe here?
        this.mqtt?.subscribe(this.TOPICS.STATUS)
        cleanup()
        resolve()
      }
      const cleanup = () => {
        this.mqtt?.removeListener('error', handleErr)
        this.mqtt?.removeListener('connect', handleConnect)
      }
      this.mqtt.once('error', handleErr)
      this.mqtt.once('connect', handleConnect)
    })
  }
  async _stop() {
    await new Promise<void>((resolve, reject) => {
      if (this.mqtt == null) return resolve()
      this.mqtt.removeAllListeners()
      this.mqtt?.unsubscribe(this.TOPICS.STATUS)
      this.mqtt.end(undefined, undefined, () => resolve())
    })
  }

  _handleMessage = (topic: string, messageBuff: Buffer, packet: Packet) => {
    if (topic !== this.TOPICS.STATUS) return
    let messageStr
    let message
    try {
      messageStr = messageBuff.toString()
      message = JSON.parse(messageStr)
    } catch (err) {
      throw DysonDeviceClientError.wrap(err, 'invalid message buffer', {
        message: messageBuff.toString(),
      })
    }
    this._handleStatusMessage(message, packet)
  }
  _handleStatusMessage = (message: MessageType, packet: Packet) => {
    console.log(message)
    switch (message.msg) {
      case MessageMsgType.ENVIRONMENTAL_CURRENT_SENSOR_DATA:
        //
        break
      case MessageMsgType.CURRENT_STATE:
        //
        break
      case MessageMsgType.STATE_CHANGE:
        //
        break
    }
  }
}

function decryptCredentials(credentials: string): string {
  crypto.randomBytes(32).toString('hex')
  // @ts-ignore
  const ENC_KEY = Buffer.from([
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    '10',
    '11',
    '12',
    '13',
    '14',
    '15',
    '16',
    '17',
    '18',
    '19',
    '20',
    '21',
    '22',
    '23',
    '24',
    '25',
    '26',
    '27',
    '28',
    '29',
    '30',
    '31',
    '32',
  ])
  // @ts-ignore
  const IV = Buffer.from([
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
  ])
  let decipher
  let decrypted
  let json

  try {
    decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, IV)
    decrypted = decipher.update(credentials, 'base64', 'utf-8')
    decrypted += decipher.final('utf-8')
    json = JSON.parse(decrypted)
  } catch (err) {
    throw DysonDeviceClientError.wrap(err, 'invalid password', {
      credentials,
      decrypted,
    })
  }

  return json.apPasswordHash
}
