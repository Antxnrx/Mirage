# Mirage

> A send guard for Zcash wallets: before money leaves the shielded pool, Mirage checks how easy the exit is to link, sends shielded when it can, and when it can't, splits the funds inside the pool and lets them out on a schedule.

| | |
|---|---|
| **Track** | Privacy |
| **Privacy theme(s)** | 1. Private payment rails · 3. Privacy beyond the transaction |
| **What it is** | Web app + API + reusable TypeScript library (`mirage-core`) |
| **Live URL** | _TBD (deploying)_ |
| **Demo video** | _TBD_ |
| **Testnet txid** | `78644a966fa467cf3aa99d631d004a3f3b9bcb70500a68145fdd21b3607e1cf0`: a guarded exit's shielded prepare step (one self-send splitting the amount into five notes inside the pool) · https://zexplorer.app/testnet/tx/78644a966fa467cf3aa99d631d004a3f3b9bcb70500a68145fdd21b3607e1cf0 |
| **Team** | Megh Vyas (@MeghVyas3132), Anton (@Antxnrx) |

---

## 1. The problem and who it's for

- **User:** people who move ZEC between the shielded pool and an exchange or swap service, which is most people who ever buy or sell ZEC.
- **Problem:** inside the shielded pool nothing is visible, but the value crossing the pool boundary and its time are public. If the amount that leaves matches an amount that recently entered, an observer can pair them, and the privacy of everything in between is gone. Wallets warn that "this is public" but don't tell you whether *this* exit is linkable.
- **Evidence:**
  - **Research:** amount-and-timing matching linked 31.5% of coins sent to shielded addresses ([Quesnelle 2017](https://arxiv.org/abs/1712.01210)); see also [Kappos et al., USENIX Security 2018](https://www.usenix.org/node/217538).
  - **Industry:** Arkham reported labeling over half of ZEC transactions without breaking any cryptography, using transparent-side and behavioral data ([crypto.news](https://crypto.news/zcash-privacy-tested-as-arkham-tracks-53percent-of-zec/)).
  - **Real incident:** a wallet route sent swap refunds back to the user's original transparent address, making the link obvious ([report](https://www.cryptopolitan.com/zachxbt-flags-privacy-flaw-in-zashi-wallets-near-intents-integration/)).
  - **The gap we fill:** linkability checkers exist ([zcrowd](https://github.com/Kylne700/zcrowd), [am-i-linkable](https://github.com/Adeolu05/am-i-linkable), [CipherScan](https://forum.zcashcommunity.com/t/cipherscan-2026-privacy-intelligence-for-zcash/54151)), but you run them separately, before you send. zcrowd's own README lists the wallet hook as roadmap. Mirage is that piece: the check lives **inside the send**, and acts on the result.
  - **Conversations at the venue:** _to be added: only real conversations, quoted with permission._

## 2. What it does

1. **Enter:** you type a destination and an amount.
2. **Shielded destination** (`utest1…`): Mirage sends a fully shielded payment with an encrypted memo. Nothing about it is public.
3. **Transparent destination** (`tm…`, e.g. an exchange deposit): Mirage scores the exit against an index of every public shield and deshield on the chain.
   - 🟢 A big crowd of similar crossings: sent.
   - 🟡 / 🔴 Few or none: **held**, and Mirage proposes a guarded exit.
4. **Guarded exit:** one **fully shielded self-send** splits the amount into common denominations inside the pool. Each piece is then scheduled to leave separately. Right before each piece goes, the check runs again, and a piece that still stands out is held and re-checked later. Value that doesn't fit a common denomination stays shielded.

## 3. Try it in 5 minutes

**Without installing anything:** _live URL coming. Open it, pick the `demo-user` wallet, then:_
1. Send `0.01` to the other wallet's `utest1…` address (shown under Wallet when you switch accounts): it goes out shielded, and the memo shows up in that wallet's Activity.
2. Send `0.0731` to a `tm…` address: it is held 🔴 with a split proposal. Click **Run guarded exit** and watch the pieces leave under *Guarded exits*.

**Run it locally:**

```bash
git clone https://github.com/MeghVyas3132/Mirage-Zcash.git
cd Mirage-Zcash
docker compose up -d --build   # zkool wallet engine (private) + Mirage on http://localhost:8787
```

Then create and fund wallets:
1. Create two testnet accounts in zkool (GraphQL `createAccount`, see `docs/03-architecture.md`).
2. Claim TAZ from [Fauzec](https://fauzec.com) to the first account's `utest1…` address.
3. Open http://localhost:8787.

**Requirements:** Docker. Without Docker: Node 22+, and a [zkool_graphql](https://github.com/hhanh00/zkool2/releases) testnet server on `127.0.0.1:8000`; then `npm install && npm start -w server`.

**Test funds:** [Fauzec](https://fauzec.com) (1 TAZ per address per day). Testnet only.

Settings live in [`.env.example`](.env.example). `EXIT_DELAY_SCALE=0.01` turns the real hours-apart schedule into minutes for a demo.

## 4. What actually works

| Step in the core flow | Status | Evidence |
|---|---|---|
| Index every public shield/deshield on testnet (Sapling, Orchard, Ironwood) from lightwalletd compact blocks | ✅ real | `server/src/indexer.ts`; live at `/api/index` |
| Score an exit: crowd size + candidate entries | ✅ real | `packages/core/src/score.ts`, 8 tests |
| Shielded send with encrypted memo, detected by the receiving wallet | ✅ real | `250fe9867a80df3349127ffe24119d400d37bc03056421e4835919dd29f93cf6` (memo `rent nov (demo)`) |
| Hold a linkable transparent send | ✅ real | 0.0731 TAZ → `tm…` held at 🔴 crowd 0 |
| Guarded exit: shielded in-pool split | ✅ real | `78644a96…1cf0` |
| Guarded exit: pieces leave on schedule, re-checked before each | ✅ real | `78dc8b27…`, `a3bbac45…`, `c4271e84…`, `579af626…`, `4ab47359…` |

**Known limitations:**
- **Low testnet traffic:** crowds are small, so most exits score 🟡/🔴. On mainnet the same check has far more crossings to compare against.
- **One destination per exit:** pieces go to the destination you give. They aren't linked to your entry, but they share that destination.
- **Demo schedule:** the live demo uses `EXIT_DELAY_SCALE=0.01` (minutes, not hours).
- **Heuristic:** the score covers amount and timing only, not wallet fingerprints or network metadata.

## 5. Privacy and trust

1. **What stays private?** Every shielded payment and every in-pool split: sender, receiver, amount and memo are shielded on-chain. The index is public chain data only.
2. **What does the app reveal, and to whom?**
   - **`testnet.zec.rocks` (light-wallet server):** sees the server's IP and sync timing.
   - **Chain observers:** see each transparent exit piece (amount and time). That's unavoidable when leaving the pool; Mirage's job is to make those pieces look like many others.
   - **Our server:** stores the public index, exit schedules (amounts, destination, txids) and the demo wallets. No emails, names or IPs are stored by Mirage.
3. **Who do users have to trust?**
   - **The light-wallet server:** for chain data.
   - **Whoever runs the wallet engine:** run locally, that's you. **On the hosted demo, the two testnet wallets are held by us, the operators.** That's fine for TAZ; for real funds, run Mirage locally.
4. **What would you fix next?**
   - **Network privacy:** route sync and broadcast over Nym.
   - **No server needed:** let the browser score against a locally built index, so no server is needed for checks.
   - **Better destinations:** support fresh destination addresses per piece where the receiver allows it (e.g. ZIP 320 TEX for exchanges).

## 6. How it's built

- **Technologies used:**
  - **Wallet engine:** [zkool_graphql](https://github.com/hhanh00/zkool2) v6.36.0
  - **Chain data:** lightwalletd gRPC (LightWalletD v0.6.1 at `testnet.zec.rocks:443`), [lightwallet-protocol](https://github.com/zcash/lightwallet-protocol) protos (vendored, MIT)
  - **Server:** Node 22, TypeScript 5, Hono 4, `@grpc/grpc-js`
  - **Deployment:** Docker
- **Architecture:**

  ```
  Browser ── Mirage API (Hono) ── mirage-core (score + plan)
                 │        └── Indexer ── lightwalletd (testnet.zec.rocks) ── Zcash testnet (NU7)
                 └── zkool_graphql (wallet engine, private network only)
  ```

- **Code worth reading:**
  - **`server/src/indexer.ts`:** classifies each transaction as a shield or deshield from compact blocks with transparent data, resolving older inputs on demand.
  - **`server/src/api.ts`** (`/api/send`, `/api/guarded-exit`): the guard.
  - **`server/src/jobs.ts`:** the scheduler that re-checks and holds pieces.
  - **`packages/core`:** scoring and planning, with no dependencies.
- **Built during the hack vs before:** everything in this repo was written during the hack (4 Nov 2026). We use zkool, lightwalletd and the lightwallet-protocol definitions as-is.
- **Reusable parts:** `mirage-core`, a small library any wallet can call before a deshield or swap: `assess(index, {zats, time})` and `planExit(zats)`.

## 7. What's next (30 days)

- **Next milestone:** a mainnet index plus `mirage-core` published on npm, and a pre-send hook PR to a Zcash wallet.
- **Who benefits:** wallets without a linkability check, and their users.
- **Already started:** _links to the upstream issue and forum post go here._

## 8. Links

- Repo: https://github.com/MeghVyas3132/Mirage-Zcash
- Demo video: _TBD_
- Live app: _TBD_
- Docs: [`docs/`](docs/)

## Feedback

See [FEEDBACK.md](FEEDBACK.md).

## License

MIT

---

## Resources used

- Privacy track brief: https://stadium.joinwebzero.com/programs/free-society-hack-2026/privacy/llms.txt
- Testnet faucet: https://fauzec.com
- Testnet explorer: https://zexplorer.app (`/testnet/tx/<txid>`)
- lightwalletd: https://github.com/zcash/lightwalletd
