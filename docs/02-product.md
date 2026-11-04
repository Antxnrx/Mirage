# 02 · Product

## What Mirage is
A privacy check that runs **before** a transaction leaves the shielded pool, plus a planner that makes the exit hard to link.

**Tagline:** snoops see a crowd, not you.

## What the user sees

### 1. The check
```
🔴 Traceable
You're sending 0.7342 ZEC to a transparent address.
1 recent deposit into the shielded pool matches this amount
(0.7342 ZEC, 40 min ago).
Your crowd: 1.

[ Safe Exit ]   [ Send anyway ]
```

The **crowd** is the number of recent boundary crossings that look like yours: a similar amount in a similar time window. A bigger crowd means a harder link.

### 2. Safe Exit
Mirage proposes a plan:
```
0.30   ZEC  in ~3 h   → fresh address
0.25   ZEC  in ~7 h   → fresh address
0.1842 ZEC  tomorrow  → fresh address
Crowd after: 25+ 🟢
```
- **Common amounts:** splits into amounts many others also move.
- **Random delays:** breaks the timing link.
- **Fresh addresses:** a new receiving address per piece.
- **Private broadcast:** sends over Nym where available, hiding the user's IP from the network.

### 3. Exit audit (stretch)
Given a viewing key (read-only), list past exits that were easy to link.

## Two modes

| Mode | For | How it sends |
|---|---|---|
| **Check & Send** | Everyday users | Web dApp connected to **Noir Wallet**. Mirage scores the exit; each Safe Exit piece is approved in the Noir popup. |
| **Autopilot** | Power users, the library | **zkool_graphql** wallet engine runs the schedule; broadcast over **Nym**. |

## For builders
The scoring and planning logic ships as a small library (`mirage-core`) that other Zcash wallets can call before any deshield or swap.

## What Mirage does *not* do
- **Funds:** it never holds user funds or keys. It only reads public chain data and schedules the user's own transactions.
- **Pooling:** it doesn't mix funds with other users and doesn't run a coordinator.
- **Guarantees:** it doesn't promise anonymity. It reports a heuristic estimate and reduces linkability.
- **Network:** testnet only for this build.

## Core flow (hackathon scope)
1. **Connect:** connect Noir Wallet (testnet) and show the shielded balance.
2. **Enter:** the user enters an amount and a transparent destination.
3. **Score:** Mirage scores it against the boundary index (recent crossings from `testnet.zec.rocks`).
4. **Plan:** if the crowd is small, show the Safe Exit plan.
5. **Execute:** send each piece, showing txids and explorer links.
6. **Re-score:** show the crowd after.
