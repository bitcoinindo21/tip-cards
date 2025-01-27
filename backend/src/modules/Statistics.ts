import axios from 'axios'
import z from 'zod'
import { ErrorWithCode, ErrorCode } from '@shared/data/Errors'
import type { StatisticsPeriod } from '@backend/trpc/data/StatisticsPeriod'
import { LNBITS_ORIGIN, LNBITS_INVOICE_READ_KEY, STATISTICS_EXCLUDE_FILE, STATISTICS_PREPEND_FILE } from '@backend/constants'
import loadJsonIfExists from '../services/loadJsonIfExists'
import { DateTime } from 'luxon'

const Payment = z.object({
  pending: z.boolean(),
  time: z.number(),
  amount: z.number(),
  payment_hash: z.string(),
})
type Payment = z.infer<typeof Payment>

export default class Statistics {
  public static async getStatistics() {
    const payments = await Statistics.loadPayments()
    const daily = Statistics.accumulatePaymentsByPeriod(payments, 'yyyy-MM-dd')
    const weekly = Statistics.accumulatePaymentsByPeriod(payments, 'kkkk-WW')
    return {
      daily,
      weekly,
    }
  }

  private static async loadPaymentsFromLnbits() {
    let response
    try {
      response = await axios.get(`${LNBITS_ORIGIN}/api/v1/payments`, {
        headers: {
          'X-Api-Key': LNBITS_INVOICE_READ_KEY,
          'Content-type': 'application/json',
        },
      })
      return Payment.array().parse(response.data)
    } catch (error) {
      throw new ErrorWithCode(error, ErrorCode.UnableToGetLnbitsPaymentRequests)
    }
  }

  private static async loadPayments() {
    const paymentHashesToExclude = loadJsonIfExists<string[]>(STATISTICS_EXCLUDE_FILE, [])
    const paymentsToPrepend = loadJsonIfExists<Payment[]>(STATISTICS_PREPEND_FILE, [])

    const paymentsFromLnbits = await Statistics.loadPaymentsFromLnbits()
    const payments = [
        ...paymentsToPrepend,
        ...paymentsFromLnbits,
      ]
      .filter(
        ({ payment_hash }) => !paymentHashesToExclude.includes(payment_hash),
      )

    payments.sort((a, b) => b.time - a.time)

    return payments
  }

  private static accumulatePaymentsByPeriod(payments: Payment[], periodLabelDatetimeFormat: string): StatisticsPeriod[] {
    const periods: Record<string, {
      fundingAmount: number,
      fundingCount: number,
      withdrawAmount: number,
      withdrawCount: number,
    }> = {}

    payments.forEach((payment) => {
      if (payment.pending || Number.isNaN(payment.time)) {
        return
      }
      const dt = DateTime.fromSeconds(payment.time)
      const periodLabel = dt.toFormat(periodLabelDatetimeFormat)
      if (periods[periodLabel] == null) {
        periods[periodLabel] = {
          fundingAmount: 0,
          fundingCount: 0,
          withdrawAmount: 0,
          withdrawCount: 0,
        }
      }
      if (payment.amount > 0) {
        periods[periodLabel].fundingAmount += payment.amount / 1000
        periods[periodLabel].fundingCount += 1
      }
      if (payment.amount < 0) {
        periods[periodLabel].withdrawAmount += -payment.amount / 1000
        periods[periodLabel].withdrawCount += 1
      }
    })

    return Object.entries(periods).map(([periodLabel, values]) => ({
      periodLabel,
      ...values,
    }))
  }
}
