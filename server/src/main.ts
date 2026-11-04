import { serve } from '@hono/node-server';
import { config } from './config.js';
import { createClient } from './lightwalletd.js';
import { Indexer } from './indexer.js';
import { createApi } from './api.js';

const lwd = createClient();
const indexer = new Indexer(lwd);
await indexer.load();

serve({ fetch: createApi(indexer).fetch, port: config.port, hostname: config.host }, (i) =>
  console.log(`mirage-server on http://${config.host}:${i.port} (lightwalletd ${config.lwdHost})`),
);

const tick = () => indexer.sync().catch((e) => console.error('index sync failed:', e.message));
await tick();
setInterval(tick, config.pollSecs * 1000);
