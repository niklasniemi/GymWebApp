import { useEffect, useRef, useState } from 'react';
import { FoodLookupError, searchOpenFoodFacts } from '../../lib/openFoodFacts';
import type { Food } from '../../types';

interface Result {
  q: string;
  status: 'loading' | 'done' | 'error';
  foods: Food[];
  error?: FoodLookupError;
}

/**
 * On-demand Open Food Facts search. It runs only when the user asks:
 * OFF throttles anonymous product search from browsers at busy times, so
 * firing it on every keystroke would mostly produce noise (and needless
 * requests). Barcode lookups use a different, unthrottled endpoint.
 */
export function useOnlineFoodSearch(query: string, enabled: boolean) {
  const q = query.trim().toLowerCase();
  const [result, setResult] = useState<Result | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => () => ctrlRef.current?.abort(), []);

  const search = () => {
    if (!enabled || q.length < 2) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    const target = q;
    setResult({ q: target, status: 'loading', foods: [] });
    searchOpenFoodFacts(target, ctrl.signal).then(
      (foods) => setResult({ q: target, status: 'done', foods }),
      (err: unknown) => {
        if (ctrl.signal.aborted) return;
        setResult({
          q: target,
          status: 'error',
          foods: [],
          error: err instanceof FoodLookupError ? err : new FoodLookupError('network', 'Food database unreachable'),
        });
      },
    );
  };

  const current = result?.q === q ? result : null;
  return {
    /** Online search can be offered for this query. */
    available: enabled && q.length >= 2,
    status: current?.status ?? 'idle',
    foods: current?.foods ?? [],
    error: current?.error,
    search,
  };
}
