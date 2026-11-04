# 04 · Competitors and related work

| Product | What it does | Gap Mirage fills |
|---|---|---|
| **Ywallet / Zkool** (Zcash) | Labels each transaction's privacy level by pool type (transparent → shielded, etc.) and can enforce a minimum level | Doesn't compare a crossing's amount and timing with other users' crossings |
| **Zodl, Zingo** (Zcash) | Shield transparent funds by default; warn when deshielding | Generic warning, no linkability estimate, no exit plan |
| **Sparrow** (Bitcoin) | Coin control, labels, transaction graph | Bitcoin only; no numeric linkability score |
| **Wasabi / CoinJoin** (Bitcoin) | Mixes coins with other users via a coordinator | Mirage doesn't pool funds or run a coordinator. It only schedules the user's own transactions. |
| **Railgun PPOI, Privacy Pools** (Ethereum) | Prove funds aren't from flagged sources | A compliance tool, not exit privacy |
| **Glasspane** (Zcash, ZecHub Hackathon 3.0) | Per-payment receipts via outgoing cipher keys | Disclosure, not linkability. Complementary. |
| **Chain-analytics firms** (Arkham, Chainalysis, Elliptic) | Trace flows for institutions | Mirage applies the same boundary analysis for the user, before they send |

**Design choice from the Bitcoin experience:** tools that take custody or coordinate other people's funds face money-transmission risk. Mirage stays non-custodial and coordinator-free: advice plus the user's own self-signed transactions.
