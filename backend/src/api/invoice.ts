import express from 'express'

import axios from 'axios'

import { ErrorCode, ErrorWithCode } from '../data/Errors'
import type { Card } from '../data/Card'
import { getCardByHash, createCard } from '../services/database'
import { checkIfCardInvoiceIsPaidAndCreateWithdrawId } from '../services/lnbitsHelpers'
import { TIPCARDS_ORIGIN, TIPCARDS_API_ORIGIN, LNBITS_INVOICE_READ_KEY } from '../constants'
import { getLandingPageLinkForCardHash } from '../../../src/modules/lnurlHelpers'
import { LNBITS_ORIGIN } from '../../../src/constants'

const router = express.Router()

router.post('/create/:cardHash', async (req: express.Request, res: express.Response) => {
  // amount in sats
  let amount: number | undefined = undefined
  let headline = ''
  let text = ''
  try {
    ({ amount, headline, text } = req.body)
  } catch (error) {
    console.error(error)
  }
  if (amount == null || amount < 100) {
    res.status(400).json({
      status: 'error',
      message: 'Invalid input.',
    })
    return
  }

  // check if card/invoice already exists
  let card: Card | null = null
  try {
    card = await getCardByHash(req.params.cardHash)
  } catch (error) {
    console.error(ErrorCode.UnknownDatabaseError, error)
    res.status(500).json({
      status: 'error',
      message: 'An unexpected error occured. Please try again later or contact an admin.',
      code: ErrorCode.UnknownDatabaseError,
    })
    return
  }
  if (card != null) {
    if (card.invoice.paid) {
      res.status(400).json({
        status: 'error',
        message: 'Card is already funded.',
      })
    } else if (card.invoice.amount === amount) {
      res.json({
        status: 'success',
        data: card.invoice.payment_request,
      })
    } else {
      res.status(400).json({
        status: 'error',
        message: `Card already exists with different amount: ${card.invoice.amount}.`,
      })
    }
    return
  }

  // create invoice in lnbits
  let payment_hash: string | undefined = undefined
  let payment_request: string | undefined = undefined
  try {
    const response = await axios.post(`${LNBITS_ORIGIN}/api/v1/payments`, {
      out: false,
      amount,
      memo: 'Fund your Lightning Tip Card',
      webhook: `${TIPCARDS_API_ORIGIN}/api/invoice/paid/${req.params.cardHash}`,
    }, {
      headers: {
        'Content-type': 'application/json',
        'X-Api-Key': LNBITS_INVOICE_READ_KEY,
      },
    })
    ;({ payment_hash, payment_request } = response.data)
    res.json({
      status: 'success',
      data: response.data.payment_request,
    })
  } catch (error) {
    console.error(ErrorCode.UnableToCreateLnbitsInvoice, error)
  }
  if (payment_hash == null || payment_request == null) {
    res.status(500).json({
      status: 'error',
      message: 'Unable to create invoice at lnbits.',
      code: ErrorCode.UnableToCreateLnbitsInvoice,
    })
    return
  }

  // persist data
  try {
    await createCard({
      cardHash: req.params.cardHash,
      headline,
      text,
      invoice:  {
        amount,
        payment_hash,
        payment_request,
        paid: false,
      },
      lnbitsWithdrawId: null,
      used: false,
    })
  } catch (error) {
    console.error(ErrorCode.UnknownDatabaseError, error)
  }
})

router.get('/paid/:cardHash', async (req: express.Request, res: express.Response) => {
  // 1. check if card exists
  let card: Card | null = null
  try {
    card = await getCardByHash(req.params.cardHash)
  } catch (error) {
    console.error(ErrorCode.UnknownDatabaseError, error)
    res.status(500).json({
      status: 'error',
      message: 'An unexpected error occured. Please try again later or contact an admin.',
      code: ErrorCode.UnknownDatabaseError,
    })
    return
  }
  if (card == null) {
    res.status(404).json({
      status: 'error',
      message: `Card not found. Go to ${getLandingPageLinkForCardHash(TIPCARDS_ORIGIN, req.params.cardHash)} to fund it.`,
    })
    return
  }
  if (card.invoice == null) {
    res.status(404).json({
      status: 'error',
      message: `Card has no funding invoice. Go to ${getLandingPageLinkForCardHash(TIPCARDS_ORIGIN, req.params.cardHash)} to fund it.`,
    })
    return
  }

  // 2. check if card already has withdrawId
  if (card.lnbitsWithdrawId != null) {
    res.json({
      status: 'success',
      data: 'paid',
    })
    return
  }

  // 3. check if invoice of card is paid and create withdrawId
  try {
    await checkIfCardInvoiceIsPaidAndCreateWithdrawId(card)
  } catch (error: unknown) {
    let code = ErrorCode.UnknownErrorWhileCheckingInvoiceStatus
    let errorToLog = error
    if (error instanceof ErrorWithCode) {
      code = error.code
      errorToLog = error.error
    }
    console.error(code, errorToLog)
    res.status(500).json({
      status: 'error',
      message: 'Unable to check invoice status at lnbits.',
      code: code,
    })
    return
  }
  if (!card.invoice.paid) {
    res.json({
      status: 'success',
      data: 'not_paid',
    })
    return
  }
  res.json({
    status: 'success',
    data: 'paid',
  })
})

export default router
