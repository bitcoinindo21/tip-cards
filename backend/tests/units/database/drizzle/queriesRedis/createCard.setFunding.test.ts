import '../../../mocks/process.env'
import {
  insertCards, insertCardVersions,
  insertInvoices, insertCardVersionInvoices,
  insertLnurlPs, insertLnurlWs,
} from '../mocks/queries'

import { createCard as createCardData, createSetFunding } from '../../../../redisData'

import { createCard } from '@backend/database/drizzle/queriesRedis'

describe('createCard', () => {
  it('should create a card from setFunding', async () => {
    const card = createCardData()
    card.setFunding = createSetFunding(210)

    await createCard(card)
    expect(insertCards).toHaveBeenCalledWith(expect.objectContaining({
      hash: card.cardHash,
      created: expect.any(Date),
    }))
    expect(insertCardVersions).toHaveBeenCalledWith(expect.objectContaining({
      card: card.cardHash,
      created: expect.any(Date),
      lnurlP: null,
      lnurlW: null,
      textForWithdraw: card.text,
      noteForStatusPage: card.note,
      sharedFunding: false,
      landingPageViewed: null,
    }))
    expect(insertInvoices).toHaveBeenCalledWith()
    expect(insertCardVersionInvoices).toHaveBeenCalledWith()
    expect(insertLnurlPs).toHaveBeenCalledWith()
    expect(insertLnurlWs).not.toHaveBeenCalled()
  })
})