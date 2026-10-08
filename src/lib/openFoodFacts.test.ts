import { describe, expect, it } from 'vitest';
import { fromOFF } from './openFoodFacts';

describe('Open Food Facts mapping', () => {
  it('maps per-100 g nutrients, brand and serving', () => {
    const f = fromOFF({
      code: '6408430000258',
      product_name: 'Rasvaton maito',
      brands: 'Valio, Arla',
      serving_quantity: '250',
      serving_size: '250 ml',
      nutriments: {
        'energy-kcal_100g': 39,
        proteins_100g: 3.5,
        carbohydrates_100g: 3.1,
        fat_100g: 0.4,
        sugars_100g: 3.1,
      },
    });
    expect(f).toMatchObject({
      id: 'off-6408430000258',
      name: 'Rasvaton maito',
      brand: 'Valio',
      barcode: '6408430000258',
      per100: { kcal: 39, protein: 3.5, carbs: 3.1, fat: 0.4, sugar: 3.1 },
      serving: { grams: 250, label: '1 serving (250 ml)' },
      liquid: true,
      source: 'off',
    });
  });

  it('falls back to kJ and skips products without energy data', () => {
    expect(fromOFF({ code: '1', product_name: 'X', nutriments: { energy_100g: 418.4 } })?.per100.kcal).toBe(100);
    expect(fromOFF({ code: '2', product_name: 'No data', nutriments: {} })).toBeNull();
    expect(fromOFF({ code: '3', nutriments: { 'energy-kcal_100g': 50 } })).toBeNull();
  });
});
