export enum ErrorCode {
  UnknownDatabaseError = 'UnknownDatabaseError',
  CardByHashNotFound = 'CardByHashNotFound',
  UnableToGetLnurl = 'UnableToGetLnurl',
  WithdrawIdNotFound = 'WithdrawIdNotFound',
  UnableToResolveLnurl = 'UnableToResolveLnurl',
}
export type Error = {
  code: ErrorCode;
  timestamp: number; // first time the error has occurred for a task
  count: number; // how often has the error occurred
}
