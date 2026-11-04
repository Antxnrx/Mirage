# 02 · Product

## What Mirage is
A privacy check for Zcash users that keeps them **shielded first**. Before any money leaves the shielded pool, Mirage shows how traceable the exit would be. It then prepares the funds **inside the pool** with fully shielded transactions, so that any exit that's still needed is hard to link.

**Tagline:** snoops see a crowd, not you.

## Principles
1. **Shielded first.** If the destination accepts a shielded (`utest1…`) address, pay it shielded. Nothing about the payment is visible.
2. **Protect inside the pool.** Splitting and timing happen through shielded `utest1 → utest1` transactions, invisible on-chain.
3. **Exit only when you must,** and only in a way that blends in.

## What the user sees

### 1. The check
```
🔴 Traceable
You're about to send 0.7342 ZEC to a transparent address.
1 recent deposit into the shielded pool matches this amount
(0.7342 ZEC, 40 min ago).
Your crowd: 1.

[ Pay shielded instead ]   [ Prepare a safe exit ]   [ Send anyway ]
```
The **crowd** is the number of recent boundary crossings that look like yours: a similar amount in a similar time window.

### 2. Pay shielded instead
If the recipient has a unified address with a shielded receiver, Mirage sends a fully shielded payment with an encrypted memo. Result: 🟢 *Nothing about this payment is public.*

### 3. Prepare (fully shielded)
A shielded self-send splits the balance into common amounts **inside the pool**:
```
utest1 (you) → utest1 (you)
  notes created: 0.30 · 0.25 · 0.1842 ZEC
  memo (encrypted): "mirage:prepare"
```
On-chain, this is a shielded transaction: amounts, sender and receiver are hidden.

### 4. Exit (only if needed)
Each prepared note can leave the pool separately, at a time Mirage suggests, to a fresh address. Before each piece, the check runs again so the user sees the crowd for that piece.

### 5. Exit audit (stretch)
Given a viewing key (read-only), list past exits that were easy to link.

## Two modes

| Mode | For | How it sends |
|---|---|---|
| **Check & Send** | Everyday users | Web dApp connected to **Noir Wallet** (testnet). Shielded payments and the prepare step are approved in the Noir popup. |
| **Autopilot** | Power users, the library | **zkool_graphql** wallet engine: a multi-recipient shielded `pay` for the prepare step, scheduled pieces after it, network traffic over **Nym**. |

## For builders
The scoring and planning logic ships as a small library (`mirage-core`) that other Zcash wallets can call before any deshield or swap.

## What Mirage does *not* do
- **Funds:** it never holds user funds or keys. It reads public chain data and schedules the user's own transactions.
- **Pooling:** it doesn't mix funds with other users and doesn't run a coordinator.
- **Guarantees:** it doesn't promise anonymity. It reports a heuristic estimate and reduces linkability.
- **Network:** testnet only for this build.

## Core flow (hackathon scope, all on public testnet)
1. **Connect:** connect Noir Wallet (testnet) and show the shielded balance.
2. **Enter:** the user enters an amount and a destination.
3. **Score:** Mirage scores it against the boundary index built from `testnet.zec.rocks`.
4. **Shielded destination:** send a **fully shielded payment** with a memo, and show the txid and explorer link.
5. **Transparent destination:** run the **shielded prepare step** (`utest1 → utest1`), show the txid and the new crowd estimate, then optionally exit one piece.
6. **Detect:** the receiving side detects the shielded payment through a viewing key (zkool watch-only account) and shows the decrypted memo.
