import type { BulkWithdraw as BulkWithdrawRedis } from '../../../../../src/data/redis/BulkWithdraw'

import WithdrawDeletedError from '../../../errors/WithdrawDeletedError'
import { isBulkWithdrawWithdrawn } from '../../../services/lnbitsHelpers'

import type { BulkWithdraw } from '../BulkWithdraw'

/**
 * @throws WithdrawDeletedError
 * @throws ZodError
 * @throws AxiosError
 */
export const bulkWithdrawFromBulkWithdrawRedis = async (bulkWithdraw: BulkWithdrawRedis): Promise<BulkWithdraw> => {
  if (bulkWithdraw.lnbitsWithdrawDeleted) {
    throw new WithdrawDeletedError(`Lnbits withdraw link for bulkWithdraw ${bulkWithdraw.id} is already deleted, this bulkWithdraw cannot be used anymore.`)
  }
  return {
    lnurl: bulkWithdraw.lnurl,
    created: bulkWithdraw.created,
    amount: bulkWithdraw.amount,
    numberOfCards: bulkWithdraw.cards.length,
    withdrawPending: await isBulkWithdrawWithdrawn(bulkWithdraw),
    withdrawn: bulkWithdraw.withdrawn,
  }
}