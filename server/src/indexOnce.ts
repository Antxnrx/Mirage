import { createClient } from './lightwalletd.js';
import { Indexer } from './indexer.js';

const lwd = createClient();
const indexer = new Indexer(lwd);
await indexer.load();
await indexer.sync();
const c = indexer.index.crossings;
console.log(`index ${indexer.index.fromHeight}..${indexer.index.toHeight}: ${c.filter((x) => x.direction === 'shield').length} shields, ${c.filter((x) => x.direction === 'deshield').length} deshields`);
lwd.close();
