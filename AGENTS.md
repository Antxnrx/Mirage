# AGENTS.md: context for coding agents working on Mirage

Read this first. It is the single source of truth for what Mirage is, how it runs, and what the frontend must do.

## 1. What Mirage is (30 seconds)

Zcash's shielded pool hides sender, receiver and amount. **Moving money out of the pool is public** (amount + time). If the amount that leaves matches an amount that recently entered, anyone can link the two, and the user's privacy is gone.

**Mirage is a send guard inside the wallet:**

- **To a shielded address** (`utest1…`): sent fully shielded, with an encrypted memo. Nothing public.
- **To a transparent address** (`tm…`, e.g. an exchange): Mirage first scores how linkable the exit is.
  - 🟢 **green:** many similar crossings → sent.
  - 🟡 **amber / 🔴 red:** few or none → **held**, and Mirage proposes a **guarded exit**.
- **Guarded exit:**
  1. One **fully shielded self-send** splits the amount into common sizes *inside the pool*.
  2. Each piece then leaves on its own schedule, re-checked right before it's sent.
  3. A piece that still stands out is held and retried later. Leftover dust stays shielded.

Network: **Zcash public testnet only** (NU7, Ironwood pool). Coins are TAZ and worthless. Never touch mainnet.

Event: Free Society Hack, Mumbai. Privacy track. **Finalize on Stadium by Wed 4 Nov 20:00 IST; hard close Thu 5 Nov 00:00 IST.** Judging rubric: https://stadium.joinwebzero.com/programs/free-society-hack-2026/privacy/llms.txt (Works · Private · Easy · Needed · Continuing · Bonus).

## 2. Team and ownership

| Who | Owns |
|---|---|
| Megh Vyas (@MeghVyas3132) | Backend, infra, API, deployment. **Don't change the API contract without him.** |
| Anton (@Antxnrx) | UI/UX, frontend, demo video |

## 3. Repo layout

```
packages/core/            mirage-core: scoring (assess) + planning (planExit). Pure TS, no deps. Tests in test/.
server/src/
  main.ts                 boots API, indexer loop, exit-job loop
  api.ts                  HTTP API (Hono). The guard lives in POST /api/send.
  indexer.ts              builds the public boundary index from lightwalletd compact blocks
  jobs.ts                 guarded-exit scheduler (re-checks and holds pieces)
  zkool.ts                wallet engine client (zkool_graphql over GraphQL)
  lightwalletd.ts         gRPC client for testnet.zec.rocks
web/                      THE UI source. React, Tailwind and shadcn/ui, with its own package.json (not a root workspace). ← frontend work happens here
server/public/            Built UI, committed. Don't edit by hand: run `npm install && npm run build` in web/. The server needs no build step.
server/proto/             vendored lightwallet-protocol protos (MIT)
deploy/                   Dockerfiles (zkool for x86 + ARM64), OCI compose + Caddy site
docs/                     product, architecture, competitors, trust note, research
README.md                 submission README (organizers' template). Keep its headings.
FEEDBACK.md               feedback for Zcash teams
```

## 4. Run it locally

You need **Docker** (wallet engine) and **Node 22+**.

```bash
# 1. Wallet engine (zkool_graphql) on 127.0.0.1:8000. Unauthenticated, so never expose it.
#    macOS/x86: the release binary runs in Ubuntu 24.04 under linux/amd64:
docker run -d --name zkool --platform linux/amd64 -p 127.0.0.1:8000:8000 \
  -v "$PWD/.zkool-data:/data" -v "$PWD/.zkool-data/params:/root/.zcash-params" \
  ubuntu:24.04 sh -c "apt-get update -qq && apt-get install -y -qq ca-certificates curl >/dev/null && \
  curl -fsSL -o /z https://github.com/hhanh00/zkool2/releases/download/zkool-v6.36.0/zkool_graphql && chmod +x /z && \
  /z -d /data/wallet.db -p 8000 --bind-address 0.0.0.0 -l https://testnet.zec.rocks:443 -C 1 --allow-unauthenticated --allow-unencrypted-database"

# 2. Mirage
npm install
ZKOOL_ACCOUNTS=1,2 EXIT_DELAY_SCALE=0.01 npm start -w server   # → http://localhost:8787
```

Or `docker compose up -d --build` (both together).

**Fresh wallet engine:**
1. Create two accounts via GraphQL `mutation { createAccount(newAccount: { name: "megh-wallet", key: "", useInternal: true, aindex: 0, birth: <currentHeight> }) }`.
2. Fund the first from https://fauzec.com (1 TAZ/day/address).
3. Send some to the second from the UI.

**Frontend-only work: no `.env`, no wallet, no keys needed.** Serve the folder and point the page at the live API:

```bash
npx serve server/public -l 5173        # or: python3 -m http.server 5173 -d server/public
open "http://localhost:5173/?api=https://mirage.140-238-167-7.nip.io"
```

`?api=` is remembered in the browser (localStorage key `mirage.api`); `?api=` with an empty value resets to same-origin. CORS is open on `/api/*`.

⚠ **This talks to the real demo wallets.** Sends spend real testnet TAZ from megh-wallet/demo-user (caps: 0.1 TAZ per send, 30 sends/hour shared by everyone). Use "Check only" while styling, and don't burn the demo balance before the video.

**Demo speed:** `EXIT_DELAY_SCALE=0.01` turns hours-apart exit pieces into minutes.

## 5. API reference (all JSON; amounts are decimal TAZ strings unless noted)

Base: same origin as the page (`/api/...`). CORS is open on `/api/*`.

### Read

| Method & path | Returns |
|---|---|
| `GET /api/health` | `{ ok, network:"testnet", toHeight, crossings, limits:{ maxPerRequestZec, sendsPerHour } }` |
| `GET /api/accounts` | `[{ id, name, address }]`: wallets the UI can switch between (demo: `megh-wallet`, `demo-user`) |
| `GET /api/wallet?account=ID` | `{ account, address, balance:{ transparent, sapling, orchard, ironwood } }`. **Shielded = sapling + orchard + ironwood.** |
| `GET /api/activity?account=ID` | `[{ txid, height, time (unix s), net, fee, received:[{ amount, memo, pool }], explorer }]`, newest first. `pool`: 0 transparent, 1 sapling, 2 orchard, 3 ironwood. `height` 0/null = not mined yet. Memos may contain `\n`. |
| `GET /api/exits?account=ID` | Guarded exits (see shape below) |
| `GET /api/index` | Full public boundary index `{ network, fromHeight, toHeight, generatedAt, crossings:[{ txid, height, time, direction:"shield"|"deshield", zats, pools }] }`. Large; only needed for client-side scoring or charts. |
| `POST /api/assess` `{ amount }` | Server-side score (CLI and tests). **The UI's "Check only" must NOT call this**; it scores locally with `assessLocal()` on `/api/index`, so the amount stays private. Score without sending: `{ level:"red"|"amber"|"green", crowd, reason, candidates:[{ txid, time, zats, explorer, … }] }` |

### Write (spend testnet funds)

| Method & path | Body | Returns |
|---|---|---|
| `POST /api/send` | `{ account, address, amount, memo?, force? }` | **Shielded destination:** `{ route:"shielded", sent:true, txid, explorer, note }`. **Transparent, green (or `force:true`):** `{ route:"transparent", sent:true, txid, explorer, assessment, forced }`. **Transparent, amber/red:** `{ route:"guarded", sent:false, assessment, proposal:{ pieces:[{ amount, delaySecs }], remainderStaysShielded } }`, so nothing is sent. |
| `POST /api/guarded-exit` | `{ account, address (tm…), amount }` | `{ job, prepareExplorer }`: the in-pool split was broadcast; pieces are scheduled |

**Exit job shape:**

```json
{ "id":"…", "account":2, "destination":"tm…", "createdAt":1793788200,
  "prepareTxid":"…", "prepareExplorer":"https://testnet.zecblock.com/tx/…", "remainderStaysShielded":"0.00010000",
  "pieces":[{ "amount":"0.05000000", "dueAt":1793788433, "status":"waiting|sent|failed",
              "level":"amber", "crowd":2, "holds":0, "txid":"…", "explorer":"…", "sentAt":…, "error":"held: …" }] }
```

### Errors

The body is always `{ error: "human-readable message" }`:

| Status | Meaning | Show the user |
|---|---|---|
| 400 | Bad input: amount > `limits.maxPerRequestZec` (0.1), wrong address prefix, memo > 512 bytes | The message |
| 404 | Unknown account | The message |
| 409 | **Funds still confirming** | "Funds unlock after the last transaction is mined (~30–90 s)", with a retry |
| 429 | Demo rate limit (30 spends/hour) | The message |
| 500 | Anything else | The message |

### Address prefixes (testnet)

| Prefix | Type | UI tag |
|---|---|---|
| `utest1…` | unified, shielded | "Private" |
| `ztestsapling…` | Sapling, shielded | "Private" |
| `tm…` | transparent | "Public" |
| `texs…` | TEX | "Public" |

## 6. The UI today (`web/`, built to `server/public/`)

The `web/` app replaces the original plain page and uses the same API. Screens: Home (balance, action tiles, safe exit progress, network stats, activity), Send (details → review or held → progress → seen/mined/confirmed), Receive, Check (scores an amount without sending) and Safe exit (timeline). `?api=` still works. The list below is the original page's behaviour, which the new UI keeps:

1. **Header:** network status (indexed block, number of public crossings).
2. **Wallet:** account switcher, shielded balance, pool breakdown, address and Copy button.
3. **Send:** To / Amount / Memo, with **Check & send** and **Check only**.
   - **Results:** sent shielded (green), sent transparent (with its assessment), or **Held**: assessment + candidate deposits + proposed pieces + **Run guarded exit** / **Send anyway**.
4. **Guarded exits:** each job with its prepare tx and pieces (amount, due time, status, level/crowd at send). Auto-refreshes every 20 s.
5. **Activity:** last 15 transactions with received notes, pools, memos and explorer links.

## 7. What the frontend needs (design brief)

**Goal:** make it **beautiful, calm and instantly understandable** for someone who has never heard of "deshielding". Judges score **Easy**, meaning the intended user finishes the task alone, and **Works**, meaning every step is real. Polish isn't scored by itself, but clarity is.

**Must keep (behaviour):**

- **Spending calls are slow; design for it.** `POST /api/send` and `POST /api/guarded-exit` only return after the wallet builds a zero-knowledge proof: **~20–25 s on the hosted demo** (ARM server; ~35 s for the first send after a restart), ~5 s on a fast laptop. Show a clear progress state (e.g. "Building a private proof… ~20 s", with steps or an animated indicator), disable the button, and never let the page look frozen. `GET` calls are fast (<1 s).

- **Real API only:** every flow above uses the real API. **No mocked data or fake transactions**, because a mocked step caps the Works score.
- **Show every txid** with its explorer link.
- **Pending states:** "seen → mined → confirmed". Don't claim "done" at broadcast.
- **Handle every error status** in §5, especially the 409 "funds confirming" state.
- **Testnet badge always visible.** Amounts in TAZ.

**Make it great (ideas, in priority order):**

1. **Explain the risk visually.** Show the crowd as a crowd: N dots, your exit highlighted. For red, draw the line from "your exit" to the one matching deposit.
2. **Guarded exit as a timeline:** prepare (shielded) → piece 1 → piece 2 …, with countdowns to `dueAt`, live status and re-check results.
3. **Plain confirmation screen before sending** (theme 2): who, how much, fee (~0.0001), and **who can see what**. Shielded means "nobody sees amount or parties"; transparent means "amount and time are public".
4. **Address input that recognises type:** a "Private" or "Public" tag based on the prefix, plus paste and QR.
5. **Activity:** human labels ("Received 0.02 · memo 'rent nov'"), pool chips, relative times.
6. **Responsive (mobile first) and accessible.** Colour is never the only signal: red/amber/green always carry a word.
7. **Optional:** a small "How Mirage decides" explainer, and a chart of public crossings over time from `/api/index`.

**Technical constraints:**

- **Plain static file:** keep the UI a static page served from `server/public/`. If you introduce a framework or bundler, build to `server/public/` and commit the built output so the server still serves it with no extra step. Megh deploys from `main`.
- **API calls:** don't add API calls that don't exist. Ask Megh, or add them to `server/src/api.ts` with him.
- **No secrets or real-funds features:** no secrets or keys in the frontend, no analytics or trackers (privacy project), no external fonts or CDNs unless self-hosted, and no mainnet or real-funds features.
- **Spending limit:** the per-request limit is 0.1 TAZ. Validate client-side too.

## 8. Demo scenarios (all real, on the deployed megh-wallet)

These are already in the deployed **megh-wallet**'s Activity and Guarded exits, so the UI can be designed and the video recorded against real data. Reproduce any of them from the UI. The `tm…` address below is demo-user's transparent address, so funds stay in the demo wallets.

| # | Case | How to trigger | Result | txid |
|---|---|---|---|---|
| 1 | Receive shielded payment with memo | demo-user → megh-wallet `utest1…`, memo | ✅ received, memo "Invoice #42 paid - thanks!" | `4d2d5153…f722e3` |
| 2 | Send shielded with memo | megh-wallet → demo-user `utest1…` | ✅ sent, memo "test1" | `aa8336e8…53c6c3` |
| 3 | Transparent exit, 🟢 green → sent | `0.001` → `tmNxR1byN45wkmxEUidKfcJ7y7tsf8dUnnp` | sent, crowd 83 | `cf97d0b1…c6d4a4` |
| 4 | Transparent exit, 🟡 amber → held | `0.005` → same `tm…` | held, crowd 3, proposal shown, nothing sent | — |
| 5 | Transparent exit, 🔴 red → held | `0.0731` → same `tm…` | held, crowd 0, split proposal | — |
| 6 | Guarded exit | "Run guarded exit" on case 5 | shielded prepare split + 4 scheduled pieces, each re-checked | prepare `b68ebe4c…` |
| 7 | 🔴 Send anyway (forced) | "Send anyway" on a red exit (`0.0137`) | sent, recorded with its red assessment | `67f3e758…cb7a4e6` |
| 8 | Failure: over the cap | amount `0.5` | 400 "amount must be greater than 0 and at most 0.1 TAZ" | — |
| 9 | Failure: bad address | `zs1notatestnetaddress` | 400 "destination must be a testnet address…" | — |
| 10 | Failure: funds still confirming | spend again right after a spend | 409 "Not enough confirmed shielded funds yet…" | — |

Explorer: use **https://testnet.zecblock.com/tx/<txid>** (Zexplorer was far behind the chain on 4 Nov).

## 9. Deployment

- **Production demo:** an OCI server shared with **other paying production apps**. Never run anything on it that restarts or reconfigures other services.
- **How Megh deploys:** from `main` via `deploy/oci/` (own compose project `/srv/mirage`, own Caddy site file, resource-capped).
- **Public URL:** `https://mirage.140-238-167-7.nip.io`.

## 10. Demo video (2 minutes max; judges watch only the first 2)

1. **(0:00–0:15) The problem:** "leaving the shielded pool is public; same amount in and out = linked".
2. **(0:15–0:40) Shielded send:** demo-user → megh-wallet with memo; switch wallet, the memo arrives; explorer shows nothing readable.
3. **(0:40–1:20) Held exit:** send 0.0731 to a `tm…` address → **held 🔴, crowd 0**, with the proposed split. Click **Run guarded exit**: one shielded prepare tx.
4. **(1:20–1:50) Pieces leave:** each with its re-check (crowd shown); explorer links.
5. **(1:50–2:00) Close:** "Mirage puts the linkability check inside the send. Library: mirage-core."

Use real transactions only. Mask nothing (testnet).

## 11. House rules

- **Never commit secrets:** no wallet seeds, spending keys, `.env` or `server/data/`. Viewing keys of the demo wallet are fine.
- **Commits:** commit messages are plain, with **no AI-assistant attribution lines or co-author trailers**, and no mention of AI tools anywhere in the repo.
- **Branches:** small focused commits on a branch (e.g. `ui`), PR into `main`.
- **README:** keep its section headings (they follow the judging rubric). Update screenshots there when the UI changes.
