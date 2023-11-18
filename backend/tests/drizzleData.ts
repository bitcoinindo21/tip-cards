import { randomUUID } from 'crypto'

import {
  Set, SetSettings,
  Card, CardVersion,
  Invoice, CardVersionHasInvoice,
  LnurlP, LnurlW,
} from '@backend/database/drizzle/schema'
import hashSha256 from '@backend/services/hashSha256'

export const createSet = (): Set => ({
  id: randomUUID(),
  created: new Date(),
  changed: new Date(),
})

export const createSetSettings = (set: Set): SetSettings => ({
  set: set.id,
  name: hashSha256(randomUUID()),
  numberOfCards: 8,
  cardHeadline: 'SetSettings cardHeadline',
  cardCopytext: 'SetSettings cardCopytext',
  image: 'lightning',
  landingPage: 'default',
})

export const createCard = (): Card => ({
  hash: hashSha256(randomUUID()),
  created: new Date(),
  set: null,
})

export const createCardForSet = (set: Set, cardIndex: number): Card => ({
  hash: hashSha256(`${set.id}/${cardIndex}`),
  created: new Date(),
  set: set.id,
})

export const createCardVersion = (card: Card): CardVersion => {
  const id = randomUUID()
  return {
    id,
    card: card.hash,
    created: new Date(),
    lnurlP: null,
    lnurlW: null,
    textForWithdraw: `${id} textForWithdraw`,
    noteForStatusPage: `${id} noteForStatusPage`,
    sharedFunding: false,
    landingPageViewed: null,
  }
}

export const createInvoice = (amount: number, ...cardVersions: CardVersion[]): {
  invoice: Invoice,
  cardVersionsHaveInvoice: CardVersionHasInvoice[],
} => {
  const invoice = {
    amount,
    paymentHash: hashSha256(randomUUID()),
    paymentRequest: hashSha256(randomUUID()),
    created: new Date(),
    paid: null,
    expiresAt: new Date(+ new Date() + 5 * 60 * 1000),
    extra: '',
  }
  const cardVersionsHaveInvoice = cardVersions.map((cardVersion) => ({
    cardVersion: cardVersion.id,
    invoice: invoice.paymentHash,
  }))
  return { invoice, cardVersionsHaveInvoice }
}

/** side-effect: updates cardVersion.lnurlP */
export const createLnurlP = (cardVersion: CardVersion): LnurlP => {
  const lnurlp = {
    lnbitsId: hashSha256(randomUUID()),
    created: new Date(),
    expiresAt: null,
    finished: null,
  }
  cardVersion.lnurlP = lnurlp.lnbitsId
  return lnurlp
}

/** side-effect: updates cardVersion.lnurlW */
export const createLnurlW = (...cardVersions: CardVersion[]): LnurlW => {
  const lnurlw = {
    lnbitsId: hashSha256(randomUUID()),
    created: new Date(),
    expiresAt: null,
    withdrawn: null,
  }
  cardVersions.forEach((cardVersion) => {
    cardVersion.lnurlW = lnurlw.lnbitsId
  })
  return lnurlw
}
