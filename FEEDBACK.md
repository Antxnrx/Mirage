# Feedback

What broke, confused or slowed us down, by area. For each item: what we tried, what happened, what we expected, and a link or error message.

## Node or indexer (lightwalletd, Zebra, Zaino)
- `CompactTx.fee` comes back as `0` from `testnet.zec.rocks` (LightWalletD v0.6.1), even for transactions without transparent inputs, where the proto comments say the fee is calculable. We expected the fee, or the field to be unset. We work around it by using a tolerance when matching amounts.
- The `walletrpc/*.proto` files in `zcash/lightwalletd` are symlinks into `lightwallet-protocol/`, so downloading them via raw.githubusercontent.com returns the link target path instead of the proto. We expected the proto files; we fetched them from `zcash/lightwallet-protocol` instead.

## Faucet

## SDK or wallet tool (which one, which version)

## Wallet
- Noir Wallet testnet extension v1.0.40 (`noir-wallet-v1.0.40-testnet.zip`, latest stable testnet build): receiving a shielded payment worked, but sending failed with `failed to validate tx: WtxId("private"), error: transaction did not pass consensus validation: transaction uses an incorrect consensus branch id`. Testnet is on NU7 (branch `77190ad9`), so the build appears to sign with a pre-NU7 branch id. Release candidate v1.0.41-rc (4 Nov) mentions an NU7 wallet package update; we tested it. The popup also showed a transient "Network error" banner before the send.
- Noir Wallet testnet v1.0.41-rc (`noir-wallet-v1.0.41-testnet.zip`, 4 Nov): the send form loads and shows the shielded balance, but the network fee shows "Fee estimate unavailable. Retry" and the Confirm button stays disabled, so no send is possible. Retry didn't help. We expected the documented fallback to default fee rates when RPC recommendations are unavailable.

## Docs

## Explorer
- Zexplorer (`zexplorer.app/testnet/tx/<txid>`, the link the brief recommends) showed "node syncing #4,506,028" on 4 Nov 2026 while the chain was at ~4,582,130, so every transaction from that day was "Transaction not found". testnet.zecblock.com (where testnet.cipherscan.app redirects) was in sync and showed the Ironwood details. testnet.zcashexplorer.app returns 403 to scripted requests.

## Other
