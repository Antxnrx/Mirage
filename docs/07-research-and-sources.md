# 07 · Research and sources

## Linkability research
- Quesnelle, *On the linkability of Zcash transactions* (2017): https://arxiv.org/abs/1712.01210
- Kappos, Yousaf, Maller, Meiklejohn, *An Empirical Analysis of Anonymity in Zcash* (USENIX Security 2018): https://www.usenix.org/node/217538
- Zcash docs, privacy recommendations and best practices: https://zcash.readthedocs.io/en/latest/rtd_pages/privacy_recommendations_best_practices.html
- Anonymity set and metadata (librustzcash notes): https://dannywillems.github.io/librustzcash/anonymity-set-and-metadata
- CoinDesk Research, *Encryption Supremacy*: https://www.coindesk.com/research/encryption-supremacy-zcash-and-privacy-in-the-age-of-scale

## Recent events
- Arkham tracks 53% of ZEC transactions: https://crypto.news/zcash-privacy-tested-as-arkham-tracks-53percent-of-zec/
- ZachXBT on the Zashi NEAR Intents route: https://www.cryptopolitan.com/zachxbt-flags-privacy-flaw-in-zashi-wallets-near-intents-integration/
- ECC response (ephemeral addresses, shielded refunds): https://www.mitrade.com/insights/news/live-news/article-3-1210305-20251021
- Per-swap viewing keys proposal (Zakura, Oct 2026): https://www.coindesk.com/tech/2026/10/19/zcash-developers-plan-a-fix-to-keep-zec-swaps-private-from-future-quantum-computers
- Shielded supply, ZecHub digest (Oct 2026): https://zechub.substack.com/p/zcash-ecosystem-digest-october-25th

## Existing tools
- Ywallet privacy levels: https://ywallet.app/transacting/report
- Zkool: https://github.com/hhanh00/zkool2
- Glasspane: https://glasspane-iota.vercel.app/
- Sparrow privacy features (interview): https://bitcoinmagazine.com/print/privacy-and-pain-craig-raw-creator-of-sparrow-wallet-on-self-custody

## Protocol and tooling
- Light-wallet protocol (CompactTx with transparent `vin`/`vout`, `poolTypes`): https://github.com/zcash/lightwallet-protocol
- ZIP 316 (unified addresses), ZIP 317 (fees), ZIP 320 (TEX addresses), ZIP 321 (payment URIs): https://zips.z.cash/
- Draft ZIP, disabling new value into the transparent pool (2024, still draft): https://forum.zcashcommunity.com/t/draft-zip-disabling-addition-of-new-value-to-the-transparent-pool/46599
- Nym Zcash SDK: https://zcash-sdk.nym.com/guidance/

## Notes on accuracy
Figures from news coverage (Arkham, shielded supply) are as reported and not independently verified. Academic results predate the Orchard and Ironwood pools.
