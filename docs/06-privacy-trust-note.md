# 06 · Privacy and trust note (draft)

Update this as the build changes. It gets copied into the submission.

1. **What stays private**
   - **On-chain:** sender, receiver and amount of shielded transactions; memos are encrypted.
   - **Which amount the user checks:** the browser downloads the whole boundary index and scores locally, so our server never sees it.

2. **What the app reveals, to whom**
   - **Light-wallet server (`testnet.zec.rocks`):** sees our indexer's IP and request timing (public chain data only).
   - **Our index server:** sees that someone downloaded the index (hidden behind Nym mixFetch where enabled). It never receives amounts, addresses or keys.
   - **Noir Wallet's light-wallet server:** sees the user's IP and timing when Noir syncs and broadcasts. Mirage can't route Noir's own traffic through Nym.
   - **Chain observers:** see each Safe Exit piece as a public deshield (amount and time). That's unavoidable when leaving the pool, so Mirage's job is to make those pieces look like many others.
   - **Our storage:** we keep the public index only; no user data, no logs of checked amounts.

3. **Who users must trust**
   - **Us:** to serve an honest index. The index is rebuildable from public chain data by anyone.
   - **Noir Wallet:** for keys and signing.
   - **Nym:** for network privacy where used.

4. **What we'd fix next**
   - **Broadcast:** Nym for every broadcast path.
   - **Index:** a client-side indexer option (no index server at all).
   - **Model:** publish and peer-review the crowd-score model.
