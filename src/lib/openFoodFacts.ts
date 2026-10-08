import type { Food, Nutrients } from '../types';
import { round } from './utils';

/*
 * Open Food Facts — the free, open food database (millions of products,
 * strong Nordic coverage). Used for text search and barcode lookups. Only the
 * search term / barcode is sent; nothing about the user.
 */

const BASE = 'https://world.openfoodfacts.org';
const FIELDS =
  'code,product_name,product_name_en,generic_name,brands,nutriments,serving_quantity,serving_size,quantity';

export class FoodLookupError extends Error {
  readonly kind: 'offline' | 'rate-limit' | 'network' | 'not-found';
  constructor(kind: FoodLookupError['kind'], message: string) {
    super(message);
    this.kind = kind;
  }
}

interface OFFProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  serving_quantity?: number | string;
  serving_size?: string;
  nutriments?: Record<string, number | string | undefined>;
}

const num = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
};

/** Maps an OFF product to a Food (per 100 g). Returns null without usable energy data. */
export function fromOFF(p: OFFProduct): Food | null {
  const n = p.nutriments ?? {};
  const kcal =
    num(n['energy-kcal_100g']) ??
    (num(n['energy_100g']) !== undefined ? (num(n['energy_100g']) as number) / 4.184 : undefined);
  const name = (p.product_name || p.product_name_en || p.generic_name || '').trim();
  if (kcal === undefined || !name || !p.code) return null;
  const per100: Nutrients = {
    kcal: round(kcal, 1),
    protein: round(num(n.proteins_100g) ?? 0, 1),
    carbs: round(num(n.carbohydrates_100g) ?? 0, 1),
    fat: round(num(n.fat_100g) ?? 0, 1),
  };
  const fiber = num(n.fiber_100g);
  const sugar = num(n.sugars_100g);
  if (fiber !== undefined) per100.fiber = round(fiber, 1);
  if (sugar !== undefined) per100.sugar = round(sugar, 1);
  const servingGrams = num(p.serving_quantity);
  const size = p.serving_size?.trim();
  // "30 g" alone reads oddly as a unit name — call it a serving.
  const servingLabel = size && /^[\d.,]+\s*(g|ml|cl)$/i.test(size) ? `1 serving (${size})` : size;
  const liquid =
    /\b(ml|cl|l)\b/i.test(p.serving_size ?? '') || /\b(ml|cl)\b/i.test((p as { quantity?: string }).quantity ?? '');
  return {
    id: `off-${p.code}`,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    barcode: p.code,
    per100,
    serving:
      servingGrams && servingGrams > 0
        ? {
            grams: round(servingGrams, 1),
            label: servingLabel || `1 serving (${round(servingGrams, 0)} ${liquid ? 'ml' : 'g'})`,
          }
        : undefined,
    liquid: liquid || undefined,
    source: 'off',
    createdAt: Date.now(),
  };
}

async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new FoodLookupError('offline', 'You are offline');
  }
  // Combine the caller's signal with a 9 s timeout (without AbortSignal.any for older Safari).
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  let res: Response;
  try {
    res = await fetch(url, { signal: ctrl.signal });
  } catch (err) {
    if ((err as DOMException).name === 'AbortError' && signal?.aborted) throw err;
    throw new FoodLookupError('network', 'Food database unreachable');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
  if (res.status === 429) throw new FoodLookupError('rate-limit', 'Too many searches — wait a moment');
  if (res.status === 404) throw new FoodLookupError('not-found', 'Not found');
  if (!res.ok) throw new FoodLookupError('network', `Food database error (${res.status})`);
  return (await res.json()) as T;
}

const searchCache = new Map<string, Food[]>();

/** Full-text product search (cached per query for the session). */
export async function searchOpenFoodFacts(query: string, signal?: AbortSignal): Promise<Food[]> {
  const q = query.trim().toLowerCase();
  const hit = searchCache.get(q);
  if (hit) return hit;
  const url =
    `${BASE}/cgi/search.pl?search_simple=1&action=process&json=1&page_size=24` +
    `&fields=${FIELDS}&search_terms=${encodeURIComponent(q)}`;
  const data = await getJSON<{ products?: OFFProduct[] }>(url, signal);
  const foods = (data.products ?? []).map(fromOFF).filter((f): f is Food => f !== null);
  // De-duplicate identical name+brand rows OFF sometimes returns.
  const seen = new Set<string>();
  const unique = foods.filter((f) => {
    const k = `${f.name}|${f.brand}`.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  searchCache.set(q, unique);
  return unique;
}

/** Product by barcode (EAN/UPC). Returns null when unknown or lacking nutrition data. */
export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<Food | null> {
  try {
    const data = await getJSON<{ status?: number; product?: OFFProduct }>(
      `${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`,
      signal,
    );
    if (!data.product) return null;
    return fromOFF({ ...data.product, code: data.product.code ?? code });
  } catch (err) {
    if (err instanceof FoodLookupError && err.kind === 'not-found') return null;
    throw err;
  }
}
