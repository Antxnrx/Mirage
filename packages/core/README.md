# mirage-core

Score how linkable a Zcash exit from the shielded pool is, and plan a safer one.

When value leaves the shielded pool, its amount and time are public. If an exit matches a recent entry, an observer can pair them. `mirage-core` counts how many recent public boundary crossings look like a planned exit (its **crowd**) and proposes a split into common amounts released over time.

```bash
npm install mirage-core
```

```ts
import { assess, planExit, commonDenominations, toZats } from 'mirage-core';

// index: { network, fromHeight, toHeight, generatedAt, crossings: [{ txid, height, time, direction: 'shield'|'deshield', zats, pools }] }
const a = assess(index, { zats: toZats('0.0731'), time: Math.floor(Date.now() / 1000) });
// → { level: 'red' | 'amber' | 'green', crowd, candidates, reason }

if (a.level !== 'green') {
  const plan = planExit(toZats('0.0731'), { denominations: commonDenominations(index) });
  // → { pieces: [{ zats, at }], remainderZats }: send the split shielded first, then release each piece
}
```

- **`assess`:** red when the exit stands alone (crowd 0) or pairs cleanly with one entry; amber when the crowd is below 10; green otherwise.
- **Defaults:** a 7-day window and an amount tolerance of max(20,000 zats, 0.5%), all overridable via `ScoreOptions`.
- **Heuristic:** amount and timing only. It does not cover wallet fingerprints or network metadata.
- **Pure TypeScript, no dependencies:** runs in browsers and Node.

A boundary index can be built from lightwalletd compact blocks with transparent data (`GetBlockRange` with `poolTypes`). See the Mirage server's indexer: https://github.com/MeghVyas3132/Mirage-Zcash/blob/main/server/src/indexer.ts

Part of [Mirage](https://github.com/MeghVyas3132/Mirage-Zcash), built at Free Society Hack 2026. MIT licensed.
