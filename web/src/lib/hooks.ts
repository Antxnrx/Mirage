import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';

/** Load on mount and on an interval. Late responses from an old request or account are dropped. */
export function usePoll<T>(fn: () => Promise<T>, ms: number | null, deps: DependencyList) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error>();
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    const id = ++seq.current;
    try {
      const d = await fnRef.current();
      if (id === seq.current) {
        setData(d);
        setError(undefined);
      }
    } catch (e) {
      if (id === seq.current) setError(e as Error);
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setData(undefined);
    setError(undefined);
    setLoading(true);
    void reload();
    const timer = ms ? window.setInterval(() => void reload(), ms) : undefined;
    return () => {
      seq.current++;
      if (timer) window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps]);

  return { data, error, loading, reload };
}

/** Re-renders on an interval and returns the current time in Unix seconds, for countdowns. */
export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now() / 1000), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return now;
}
