# Feedback

What broke, confused or slowed us down, by area. For each item: what we tried, what happened, what we expected, and a link or error message.

## Node or indexer (lightwalletd, Zebra, Zaino)
- `CompactTx.fee` comes back as `0` from `testnet.zec.rocks` (LightWalletD v0.6.1), even for transactions without transparent inputs, where the proto comments say the fee is calculable. We expected the fee, or the field to be unset. We work around it by using a tolerance when matching amounts.
- The `walletrpc/*.proto` files in `zcash/lightwalletd` are symlinks into `lightwallet-protocol/`, so downloading them via raw.githubusercontent.com returns the link target path instead of the proto. We expected the proto files; we fetched them from `zcash/lightwallet-protocol` instead.

## Faucet

## SDK or wallet tool (which one, which version)

## Wallet
- Noir Wallet testnet extension v1.0.40 (`noir-wallet-v1.0.40-testnet.zip`, latest stable testnet build): receiving a shielded payment worked, but sending failed with `failed to validate tx: WtxId("private"), error: transaction did not pass consensus validation: transaction uses an incorrect consensus branch id`. Testnet is on NU7 (branch `77190ad9`), so the build appears to sign with a pre-NU7 branch id. Release candidate v1.0.41-rc (4 Nov) mentions an NU7 wallet package update; we're testing it. The popup also showed a transient "Network error" banner before the send.

## Docs

## Other
