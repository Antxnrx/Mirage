# 06 · Privacy and trust note (draft)

Update this as the build changes. It gets copied into the submission.

1. **What stays private**
   - **On-chain:** sender, receiver and amount of every shielded payment and prepare step (`utest1 → utest1`); memos are encrypted.
   - **Which amount the user checks:** "Check only" downloads the whole boundary index and scores locally in the browser, so our server never sees it. (A real send still reaches the server, because the server's wallet builds the transaction.)

2. **What the app reveals, to whom**
   - **Light-wallet server (`testnet.zec.rocks`):** sees our indexer's IP and request timing (public chain data only).
   - **Our index server:** sees that someone downloaded the index (hidden behind Nym mixFetch where enabled). It never receives amounts, addresses or keys.
   - **Light-wallet server, wallet side:** our local wallet engine syncs and broadcasts through `testnet.zec.rocks`, which sees the user's IP and timing unless that traffic goes over Nym.
   - **Chain observers:** see that shielded transactions happened, and their fees. Only if the user chooses a transparent exit do they see each piece as a public deshield (amount and time). That's unavoidable when leaving the pool, so Mirage's job is to make those pieces look like many others.
   - **Our watcher:** the demo watcher holds a viewing key only (no spending key). It can read incoming amounts and memos for the demo wallet.
   - **Our storage:** we keep the public index only; no user data, no logs of checked amounts.

3. **Who users must trust**
   - **Us:** to serve an honest index. The index is rebuildable from public chain data by anyone.
   - **The local wallet engine (zkool):** keys stay on the user's machine; it runs on localhost only.
   - **Nym:** for network privacy where used.

4. **What we'd fix next**
   - **Broadcast:** Nym for every broadcast path.
   - **Index:** a client-side indexer option (no index server at all).
   - **Model:** publish and peer-review the crowd-score model.
