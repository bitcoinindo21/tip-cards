import type z from 'zod'

import type { Card as CardRedis } from '@shared/data/redis/Card'

import { getCardByHash } from '../services/database'
import { cardFromCardRedis } from '../trpc/data/transforms/cardFromCardRedis'

type CardHash = z.infer<typeof CardRedis.shape.cardHash>

export default class Card {
  /**
   * @throws ZodError
   * @throws unknown
   */
  public static async fromCardHash(cardHash: CardHash) {
    const cardRedis = await getCardByHash(cardHash)
    return new Card(cardHash, cardRedis)
  }

  /**
   * @throws ZodError
   * @throws ErrorWithCode
   */
  public async toTRpcResponse() {
    return await cardFromCardRedis(this.cardRedis)
  }

  private readonly cardHash: CardHash
  private _cardRedis: CardRedis | null
  private constructor(cardHash: CardHash, cardRedis: CardRedis | null) {
    this.cardHash = cardHash
    this._cardRedis = cardRedis
  }

  private get cardRedis(): CardRedis {
    if (this._cardRedis != null) {
      return this._cardRedis
    }
    return this.initCardRedisFromHash()
  }

  private initCardRedisFromHash(): CardRedis {
    return {
      cardHash: this.cardHash,
      text: '',
      note: '',
      invoice: null,
      lnurlp: null,
      setFunding: null,
      lnbitsWithdrawId: null,
      landingPageViewed: null,
      isLockedByBulkWithdraw: false,
      used: null,
    }
  }
}
