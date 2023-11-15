import type { CardVersion } from '@backend/database/drizzle/schema/CardVersion'
import type { Invoice } from '@backend/database/drizzle/schema/Invoice'
import {
  getLnurlPForCard,
  getInvoicesForCard, getCardsForInvoice,
  getLnurlWForCard, getCardsForLnurlW,
} from '@backend/database/drizzle/queries'

import { Card as CardRedis } from '@backend/database/redis/data/Card'

/** @throws */
export const cardRedisFromCardDrizzle = async (card: CardVersion): Promise<CardRedis> => {
  const lnurlp = await getLnurlpRedisForCard(card)
  const { invoice, setFunding } = await getFundingRedisForCard(card, lnurlp)
  const { lnbitsWithdrawId, isLockedByBulkWithdraw, used } = await getWithdrawRedisForCard(card)

  return CardRedis.parse({
    cardHash: card.card,
    text: card.textForWithdraw,
    note: card.noteForStatusPage,
    invoice,
    setFunding,
    lnurlp,
    lnbitsWithdrawId,
    landingPageViewed: dateOrNullToUnixTimestamp(card.landingPageViewed),
    isLockedByBulkWithdraw,
    used,
  })
}

/** @throws */
const getLnurlpRedisForCard = async (card: CardVersion): Promise<CardRedis['lnurlp']> => {
  const lnurlp = await getLnurlPForCard(card)
  if (lnurlp == null) {
    return null
  }

  const invoices = await getInvoicesForCard(card)
  return {
    shared: card.sharedFunding,
    amount: await getTotalPaidAmountPerCard(invoices),
    payment_hash: invoices.reduce((total, current) => [...total, current.paymentHash], [] as Invoice['paymentHash'][]),
    id: lnurlp.lnbitsId,
    created: dateToUnixTimestamp(lnurlp.created),
    paid: dateOrNullToUnixTimestamp(lnurlp.finished),
  }
}

/** @throws */
const getTotalPaidAmountPerCard = async (invoices: Invoice[]) => {
  let amount = 0
  await Promise.all(invoices.map(async (invoice) => {
    if (invoice.paid == null) {
      return
    }
    const invoiceAmountPerCard = await getInvoiceAmountPerCard(invoice)
    amount += invoiceAmountPerCard
  }))
  return amount
}

/** @throws */
const getInvoiceAmountPerCard = async (invoice: Invoice) => {
  const cards = await getCardsForInvoice(invoice)
  if (cards.length === 0) {
    return 0
  }
  return Math.round(invoice.amount / cards.length)
}

/** @throws */
const getFundingRedisForCard = async (card: CardVersion, lnurlp: CardRedis['lnurlp']): Promise<{
  invoice: CardRedis['invoice'],
  setFunding: CardRedis['setFunding'],
}> => {
  if (lnurlp != null) {
    return { invoice: null, setFunding: null }
  }

  const invoices = await getInvoicesForCard(card)
  if (invoices.length === 0) {
    return { invoice: null, setFunding: null }
  }
  if (invoices.length > 1) {
    throw new Error(`More than one invoice found for card ${card.card}`)
  }

  const cards = await getCardsForInvoice(invoices[0])
  return {
    invoice: getInvoiceRedisForInvoiceDrizzle(invoices[0], cards),
    setFunding: getSetFundingRedisForInvoiceDrizzle(invoices[0], cards),
  }
}

const getInvoiceRedisForInvoiceDrizzle = (invoice: Invoice, cards: CardVersion[]): CardRedis['invoice'] => {
  if (cards.length !== 1) {
    return null
  }
  return {
    amount: invoice.amount,
    payment_hash: invoice.paymentHash,
    payment_request: invoice.paymentRequest,
    created: dateToUnixTimestamp(invoice.created),
    paid: dateOrNullToUnixTimestamp(invoice.paid),
  }
}

const getSetFundingRedisForInvoiceDrizzle = (invoice: Invoice, cards: CardVersion[]): CardRedis['setFunding'] => {
  if (cards.length < 2) {
    return null
  }
  return {
    amount: Math.round(invoice.amount / cards.length),
    created: dateToUnixTimestamp(invoice.created),
    paid: dateOrNullToUnixTimestamp(invoice.paid),
  }
}

const dateOrNullToUnixTimestamp = (date: Date | null) => {
  if (date == null) {
    return null
  }
  return dateToUnixTimestamp(date)
}

const dateToUnixTimestamp = (date: Date) => Math.round(date.getTime() / 1000)

const getWithdrawRedisForCard = async (card: CardVersion): Promise<{
  lnbitsWithdrawId: CardRedis['lnbitsWithdrawId'],
  isLockedByBulkWithdraw: CardRedis['isLockedByBulkWithdraw'],
  used: CardRedis['used'],
}> => {
  const lnurlw = await getLnurlWForCard(card)
  if (lnurlw == null) {
    return { lnbitsWithdrawId: null, isLockedByBulkWithdraw: false, used: null }
  }
  const cards = await getCardsForLnurlW(lnurlw)
  return {
    lnbitsWithdrawId: lnurlw.lnbitsId,
    isLockedByBulkWithdraw: cards.length > 1,
    used: dateOrNullToUnixTimestamp(lnurlw.withdrawn),
  }
}