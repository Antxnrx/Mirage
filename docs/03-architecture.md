# 03 · Architecture

```
             Zcash testnet (NU7, ~25 s blocks)
                         │
           lightwalletd · testnet.zec.rocks:443
                         │  GetBlockRange(poolTypes = all)
                ┌────────▼─────────┐
                │  Boundary index  │  every shield / deshield / cross-pool move:
                │   (backend)      │  height, time, amount, pools
                └────────┬─────────┘
                         │ served as a static file (whole index, no per-user queries)
  user's browser ┌───────▼──────────────────────────────┐
                 │ mirage-core (scoring + planning)      │
                 │ React UI  ── Mirage API ── zkool      │
                 │ Nym mixFetch (index download)         │
                 └───────────────────────────────────────┘
  Autopilot:  zkool_graphql (watch + schedule + pay) ── Nym (broadcast)
```

## Components

| Component | Owner | Notes |
|---|---|---|
| **Indexer** | Backend | Streams compact blocks with transparent data and classifies each transaction |
| **Index API** | Backend | Serves the full index as one JSON file. Clients score locally, so the server never learns which amount a user is checking. |
| **mirage-core** | Backend | Crowd score: count of crossings within ±tolerance of the amount inside a time window. Planner: split into common denominations, random delays, fresh addresses. |
| **Web app** | Frontend | React, talking to the Mirage API. Check screen, plan screen, progress with txids. |
| **Shielded payments** | Backend | Fully shielded `utest1 → utest1` sends with encrypted memos through zkool_graphql `pay`; the prepare step is one multi-recipient self-send |
| **Payment watcher** | Backend | zkool_graphql watch-only account (UFVK, with `birth` height) that detects incoming shielded payments and reads their memos |
| **Autopilot** | Backend | zkool_graphql account, scheduled pieces after the prepare step |
| **Nym** | Both | `@nymproject/mix-fetch` for the index download in the browser; team has Nym subscription credits for the dVPN path. Broadcast path to be confirmed with the Nym team. |

## Classifying a transaction
The light-wallet protocol's `CompactTx` includes transparent inputs (`vin`: prevout references) and outputs (`vout`: values), alongside Sapling, Orchard and Ironwood components.

- **Deshield:** shielded components, **no** transparent inputs, transparent outputs > 0. Amount = sum of `vout`.
- **Shield:** transparent inputs plus shielded outputs. Amount ≈ sum of the referenced prevout values − sum of `vout`. Prevouts outside the scanned window are fetched with `GetTransaction`.
- **Coinbase** (index 0) and purely transparent transactions are skipped.

## Testnet feasibility check (4 Nov 2026)
| Item | Result |
|---|---|
| Server | ECC LightWalletD v0.6.1, chain `test`, consensus branch `77190ad9` (NU7) |
| Speed | 2,000 blocks in ~6 s; 20,000 blocks (~6 days) in ~42 s |
| Transparent data in compact blocks | Present when `poolTypes` includes `TRANSPARENT` |
| Crossings found in ~6 days | 37 shields, 129 deshields, mostly Ironwood, some Sapling |
| `GetTransaction` for older prevouts | Works |
| `CompactTx.fee` | Returned as 0 by this server, so shield amounts include the fee. Matching uses a small tolerance. |

Testnet has little traffic, so crowds are small. We'll state that in the demo and README, and label any crossings we create ourselves.

## Shielded-first rule
Every core flow produces **fully shielded** transactions on public testnet (`utest1` addresses, Ironwood or Sapling receivers). Transparent exits are optional and only follow a shielded prepare step.

## Stack
- **Chain data:** lightwalletd gRPC (`testnet.zec.rocks:443`), `@grpc/grpc-js`
- **Wallet:** zkool_graphql (local, testnet)
- **Network privacy:** Nym Zcash SDK / mixFetch
- **Proof links:** Zexplorer (`https://zexplorer.app/testnet/tx/<txid>`)
- **Test coins:** Fauzec faucet (TAZ)

Versions get pinned in the main README as we build.
