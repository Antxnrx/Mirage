export * from './types.js';
export * from './score.js';
export * from './plan.js';

export const ZATS_PER_ZEC = 100_000_000;
export const toZec = (zats: number) => (zats / ZATS_PER_ZEC).toFixed(8);
export const toZats = (zec: string | number) => Math.round(Number(zec) * ZATS_PER_ZEC);
