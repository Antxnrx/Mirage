import { serve } from '@hono/node-server';
import { config } from './config.js';
import { createClient } from './lightwalletd.js';
import { Indexer } from './indexer.js';
import { JobStore } from './jobs.js';
import { createApi } from './api.js';

const lwd = createClient();
const indexer = new Indexer(lwd);
const jobs = new JobStore();
await Promise.all([indexer.load(), jobs.load()]);

serve({ fetch: createApi(indexer, jobs).fetch, port: config.port, hostname: config.host }, (i) =>
  console.log(`mirage-server on http://${config.host}:${i.port} (lightwalletd ${config.lwdHost}, accounts ${config.accounts.join(',')})`),
);

const tickIndex = () => indexer.sync().catch((e) => console.error('index sync failed:', e.message));
const tickJobs = () => jobs.tick(() => indexer.index).catch((e) => console.error('exit jobs failed:', e.message));
await tickIndex();
setInterval(tickIndex, config.pollSecs * 1000);
setInterval(tickJobs, config.jobPollSecs * 1000);
