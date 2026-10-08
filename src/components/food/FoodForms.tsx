import { useId, useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { round, parseNumber, uid } from '../../lib/utils';
import type { Food, MealItem, Nutrients } from '../../types';
import { Button } from '../ui/Button';
import { Field, TextInput } from '../ui/primitives';
import { Segmented } from '../ui/Segmented';
import { SwitchRow } from '../ui/Switch';

type NutrientKey = 'kcal' | 'protein' | 'carbs' | 'fat';
type NutrientText = Record<NutrientKey, string>;

const toText = (n?: Nutrients): NutrientText => ({
  kcal: n ? String(round(n.kcal, 1)) : '',
  protein: n ? String(round(n.protein, 1)) : '',
  carbs: n ? String(round(n.carbs, 1)) : '',
  fat: n ? String(round(n.fat, 1)) : '',
});

const num = (s: string) => {
  const n = parseNumber(s);
  return n !== null && n >= 0 ? n : null;
};

/** Energy from macros (Atwater), used when kcal is left empty. */
const macroKcal = (t: NutrientText) => (num(t.protein) ?? 0) * 4 + (num(t.carbs) ?? 0) * 4 + (num(t.fat) ?? 0) * 9;

function NutrientFields({
  value,
  onChange,
  unitLabel,
  autoFocus,
}: {
  value: NutrientText;
  onChange: (v: NutrientText) => void;
  unitLabel: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const derived = macroKcal(value);
  const fields: { key: NutrientKey; label: string; unit: string }[] = [
    { key: 'kcal', label: 'Calories', unit: 'kcal' },
    { key: 'protein', label: 'Protein', unit: 'g' },
    { key: 'carbs', label: 'Carbs', unit: 'g' },
    { key: 'fat', label: 'Fat', unit: 'g' },
  ];
  return (
    <fieldset className="space-y-2">
      <legend className="px-1 pb-1.5 text-[13px] font-semibold text-fg-2">Nutrition {unitLabel}</legend>
      <div className="grid grid-cols-2 gap-2">
        {fields.map((f) => (
          <label
            key={f.key}
            htmlFor={`${id}-${f.key}`}
            className="field flex cursor-text items-center gap-2 focus-within:border-accent-text"
          >
            <span className="w-16 shrink-0 text-[13px] font-semibold text-fg-2">{f.label}</span>
            <input
              id={`${id}-${f.key}`}
              inputMode="decimal"
              autoComplete="off"
              autoFocus={autoFocus && f.key === 'kcal'}
              aria-label={`${f.label} (${f.unit})`}
              value={value[f.key]}
              placeholder={f.key === 'kcal' && derived > 0 ? String(Math.round(derived)) : '0'}
              onChange={(e) => onChange({ ...value, [f.key]: e.target.value.replace(/[^\d.,]/g, '') })}
              className="min-w-0 flex-1 bg-transparent text-right text-[16px] font-semibold tabular outline-none placeholder:text-muted/70"
            />
            <span className="w-7 shrink-0 text-xs text-muted">{f.unit}</span>
          </label>
        ))}
      </div>
      <p className="px-1 text-xs text-muted">
        Use kcal, not kJ. Leave calories empty to calculate them from the macros.
      </p>
    </fieldset>
  );
}

function readNutrients(t: NutrientText, factor = 1): Nutrients | null {
  const kcal = num(t.kcal) ?? (macroKcal(t) > 0 ? macroKcal(t) : null);
  if (kcal === null) return null;
  return {
    kcal: round(kcal * factor, 1),
    protein: round((num(t.protein) ?? 0) * factor, 1),
    carbs: round((num(t.carbs) ?? 0) * factor, 1),
    fat: round((num(t.fat) ?? 0) * factor, 1),
  };
}

/** Create or edit a custom food. Values can be entered per 100 g or per serving. */
export function FoodForm({
  initial,
  barcode,
  onSave,
  onDelete,
}: {
  initial?: Food;
  barcode?: string;
  onSave: (food: Food) => void;
  onDelete?: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(initial?.name ?? '');
  const [brand, setBrand] = useState(initial?.brand ?? '');
  const [basis, setBasis] = useState<'100' | 'serving'>('100');
  const [servingGrams, setServingGrams] = useState(initial?.serving ? String(initial.serving.grams) : '');
  const [servingLabel, setServingLabel] = useState(initial?.serving?.label ?? '');
  const [liquid, setLiquid] = useState(initial?.liquid ?? false);
  const [values, setValues] = useState<NutrientText>(() => toText(initial?.per100));
  const [code, setCode] = useState(initial?.barcode ?? barcode ?? '');
  const g = liquid ? 'ml' : 'g';

  const sg = num(servingGrams);
  const per100 = readNutrients(values, basis === 'serving' && sg ? 100 / sg : 1);
  const valid = name.trim() !== '' && per100 !== null && (basis === '100' || (sg !== null && sg > 0));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid || !per100) return;
    onSave({
      id: initial?.id ?? `custom-food-${uid()}`,
      name: name.trim().slice(0, 120),
      brand: brand.trim() || undefined,
      barcode: code.trim() || undefined,
      per100,
      serving: sg && sg > 0 ? { grams: sg, label: servingLabel.trim() || `1 serving (${sg} ${g})` } : undefined,
      liquid: liquid || undefined,
      source: 'custom',
      createdAt: initial?.createdAt ?? Date.now(),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 pb-2">
      <Field label="Name" htmlFor={`${id}-name`}>
        <TextInput
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Protein bar"
          maxLength={120}
          autoFocus
          required
        />
      </Field>
      <Field label="Brand (optional)" htmlFor={`${id}-brand`}>
        <TextInput id={`${id}-brand`} value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={80} />
      </Field>
      <div className="grid grid-cols-[1fr_1.4fr] gap-2">
        <Field label={`Serving (${g})`} htmlFor={`${id}-sg`}>
          <TextInput
            id={`${id}-sg`}
            inputMode="decimal"
            value={servingGrams}
            onChange={(e) => setServingGrams(e.target.value.replace(/[^\d.,]/g, ''))}
            placeholder="optional"
          />
        </Field>
        <Field label="Serving name" htmlFor={`${id}-sl`}>
          <TextInput
            id={`${id}-sl`}
            value={servingLabel}
            onChange={(e) => setServingLabel(e.target.value)}
            placeholder="e.g. 1 bar"
            maxLength={60}
          />
        </Field>
      </div>
      <SwitchRow checked={liquid} onChange={setLiquid} label="Drink" description="Measured in millilitres" />
      {sg !== null && sg > 0 && (
        <Segmented
          label="Values are"
          value={basis}
          onChange={setBasis}
          options={[
            { value: '100', label: `Per 100 ${g}` },
            { value: 'serving', label: 'Per serving' },
          ]}
        />
      )}
      <NutrientFields
        value={values}
        onChange={setValues}
        unitLabel={basis === 'serving' && sg ? `per serving (${sg} ${g})` : `per 100 ${g}`}
      />
      <Field label="Barcode (optional)" htmlFor={`${id}-code`}>
        <TextInput
          id={`${id}-code`}
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 14))}
          className="tabular"
        />
      </Field>
      <div className="flex gap-2">
        {onDelete && <Button size="lg" variant="danger" icon={Trash2} aria-label="Delete food" onClick={onDelete} />}
        <Button type="submit" size="lg" variant="primary" block disabled={!valid} feedback="success">
          {initial ? 'Save food' : 'Create food'}
        </Button>
      </div>
    </form>
  );
}

/** Log calories (and optionally macros) without a food. */
export function QuickAddForm({
  initial,
  submitLabel,
  onSubmit,
  onDelete,
}: {
  initial?: MealItem;
  submitLabel: string;
  onSubmit: (item: MealItem) => void;
  onDelete?: () => void;
}) {
  const id = useId();
  const [name, setName] = useState(initial?.name && initial.name !== 'Quick add' ? initial.name : '');
  const [values, setValues] = useState<NutrientText>(() => toText(initial?.nutrients));
  const nutrients = readNutrients(values);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!nutrients) return;
    onSubmit({
      name: name.trim().slice(0, 120) || 'Quick add',
      quantity: 1,
      unit: 'g',
      grams: 0,
      nutrients,
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4 pb-2">
      <Field label="Description (optional)" htmlFor={`${id}-name`}>
        <TextInput
          id={`${id}-name`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Restaurant lunch"
          maxLength={120}
        />
      </Field>
      <NutrientFields value={values} onChange={setValues} unitLabel="" autoFocus={!initial} />
      <div className="flex gap-2">
        {onDelete && <Button size="lg" variant="danger" icon={Trash2} aria-label="Delete entry" onClick={onDelete} />}
        <Button type="submit" size="lg" variant="primary" block disabled={!nutrients} feedback="success">
          {submitLabel}
          {nutrients ? ` · ${Math.round(nutrients.kcal)} kcal` : ''}
        </Button>
      </div>
    </form>
  );
}
