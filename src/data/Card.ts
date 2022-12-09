export type Card = {
  cardHash: string, // created via sha256(`${cardSetUuid}/${cardSetIndex}`)
  text: string,
  note?: string,
  invoice:  {
    amount: number,
    payment_hash: string,
    payment_request: string,
    created: number, // unix timestamp
    paid: number | null, // unix timestamp
    expired?: boolean,
  } | null,
  lnurlp: {
    shared?: boolean,
    amount: number | null,
    payment_hash: string[] | null,
    id: number,
    created: number, // unix timestamp
    paid: number | null, // unix timestamp
    expired?: boolean,
  } | null, // gets created if the user scans an unfunded card with a wallet
  lnbitsWithdrawId: string | null, // gets set as soon as the card is funded
  used: number | null, // unix timestamp
}
