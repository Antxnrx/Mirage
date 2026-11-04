# 04 · Competitors and related work

| Product | What it does | Gap Mirage fills |
|---|---|---|
| **zcrowd** (Zcash, ZECATHON 2026) | Offline CLI, library and web page: before you shield or unshield, counts how many earlier crossings look like yours (RED/AMBER/GREEN). Mainnet | Run separately before sending; the wallet hook is listed as roadmap. Mirage puts the check inside the send and acts on it (holds, splits in-pool, re-checks each piece) |
| **am-i-linkable**, **leakscope** (Zcash, ZECATHON 2026) | Browser and tool checks of whether shield/unshield amounts can be linked | Same gap: checks, no in-wallet action |
| **CipherScan** (Zcash explorer, ZCG-funded) | "Privacy Risk Detection" flags shield-then-deshield of a similar amount; privacy dashboard with recommended swap amounts | Explorer-side analysis after the fact; Mirage acts before the send |
| **Zodl** (Zcash) | Ephemeral one-time transparent addresses for swaps and TEX deposits; shielded by default | Fresh addresses, but no amount/timing linkability check |
| **Vizor** (Zcash) | Privacy-preserving staged migration (Orchard → Ironwood) over hours to days | Staged moves for pool migration, not for exits to exchanges |
| **Ywallet / Zkool** (Zcash) | Labels each transaction's privacy level by pool type (transparent → shielded, etc.) and can enforce a minimum level | Doesn't compare a crossing's amount and timing with other users' crossings |
| **Zingo** (Zcash) | Shields transparent funds by default; warns when deshielding | Generic warning, no linkability estimate, no exit plan |
| **Sparrow** (Bitcoin) | Coin control, labels, transaction graph | Bitcoin only; no numeric linkability score |
| **Wasabi / CoinJoin** (Bitcoin) | Mixes coins with other users via a coordinator | Mirage doesn't pool funds or run a coordinator. It only schedules the user's own transactions. |
| **Railgun PPOI, Privacy Pools** (Ethereum) | Prove funds aren't from flagged sources | A compliance tool, not exit privacy |
| **Glasspane** (Zcash, ZecHub Hackathon 3.0) | Per-payment receipts via outgoing cipher keys | Disclosure, not linkability. Complementary. |
| **Chain-analytics firms** (Arkham, Chainalysis, Elliptic) | Trace flows for institutions | Mirage applies the same boundary analysis for the user, before they send |

**Design choice from the Bitcoin experience:** tools that take custody or coordinate other people's funds face money-transmission risk. Mirage stays non-custodial and coordinator-free: advice plus the user's own self-signed transactions.
