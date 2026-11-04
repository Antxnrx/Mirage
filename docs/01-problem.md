# 01 · Problem

## In one line
Zcash's shielded pool hides sender, receiver and amount, but **every time value enters or leaves the pool, the amount and time are public**. Users who move the same amount in and out close together can be linked, and no wallet checks for this today.

## How it happens

Zcash has two kinds of address:

| | Transparent (`t…`) | Shielded (`u…` / `z…`) |
|---|---|---|
| Visible on-chain | Sender, receiver, amount | Nothing except that a transaction happened, and its fee |

Most exchanges and many swap routes work with transparent addresses, so a typical user's coins go:

```
exchange (public) → shield → hold privately → deshield → exchange or swap (public)
```

The value crossing the boundary is public (the transaction's net shielded value balance and its transparent inputs/outputs), and so is the block time.

### Example
1. Priya receives **0.7342 ZEC** at a transparent address her client knows.
2. She shields it. The chain shows *0.7342 entered the shielded pool at 10:05.*
3. Forty minutes later she deshields **0.7342** to a fresh address to sell.

There may be only one recent entry that matches that exit. Anyone watching can link the fresh address to her client's payment. Her privacy inside the pool was perfect; the **exit** gave her away.

## Evidence

| Source | Finding |
|---|---|
| Quesnelle, *On the linkability of Zcash transactions* (2017) | Matching shield and deshield amounts close in time linked **31.5%** of coins sent to shielded addresses |
| Kappos et al., *An Empirical Analysis of Anonymity in Zcash* (USENIX Security 2018) | Simple usage-pattern heuristics shrink the anonymity set considerably |
| Arkham Intelligence (Dec 2025, re-reported May 2026) | Labeled over **53%** of ZEC transactions and linked ~37% of balances to entities, using transparent-side and behavioral data, not by breaking cryptography |
| ZachXBT on a Zashi + NEAR Intents route (Oct 2025) | Refunds went to the same transparent address the user shielded from, making the link obvious; ECC committed to ephemeral addresses and shielded refunds in response |
| Shielded supply (ZecHub digest, Oct 2026; Blockworks Q3 2026) | Roughly 29–30% of ZEC supply is shielded, so most coins pass through the boundary at some point |
| Zcash docs: *Privacy recommendations and best practices* | Advises users against leaking amounts and timing that create linkages, but leaves it to the user to judge |

Older studies predate Sapling, Orchard and Ironwood. The cryptography has improved since then, but **the boundary is still public by design**, so the amount-and-timing heuristic still applies.

## Why existing wallet warnings aren't enough
- **Generic warnings:** wallets warn that deshielding is public, but none tell the user *"this exit matches a specific entry; your crowd is 1."*
- **Pool-type labels:** Ywallet/Zkool label transactions by **pool type** (transparent, shielded, cross-pool), not by how many other crossings look like yours.

## Who is affected
Anyone who moves ZEC between the shielded pool and an exchange, swap service or transparent address: in practice, most users who ever buy or sell.
