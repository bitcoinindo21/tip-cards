import type { BulkWithdraw as BulkWithdrawRedis } from '@shared/data/redis/BulkWithdraw'

import WithdrawDeletedError from '@backend/errors/WithdrawDeletedError'
import { isBulkWithdrawWithdrawn } from '@backend/services/lnbitsHelpers'

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
    id: bulkWithdraw.id,
    lnurl: bulkWithdraw.lnurl,
    created: new Date(bulkWithdraw.created * 1000),
    amount: bulkWithdraw.amount,
    cards: bulkWithdraw.cards,
    withdrawPending: await isBulkWithdrawWithdrawn(bulkWithdraw),
    withdrawn: bulkWithdraw.withdrawn != null ? new Date(bulkWithdraw.withdrawn * 1000) : null,
  }
}
