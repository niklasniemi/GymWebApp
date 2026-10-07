import type { Unit } from '../types';
import { round } from './utils';

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

/** kg → display unit. */
export function toDisplayWeight(kg: number, unit: Unit): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

/** display unit → kg. */
export function fromDisplayWeight(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

export function toDisplayLength(cm: number, unit: Unit): number {
  return unit === 'kg' ? cm : cm / CM_PER_IN;
}

export function fromDisplayLength(value: number, unit: Unit): number {
  return unit === 'kg' ? value : value * CM_PER_IN;
}

export const lengthUnit = (unit: Unit) => (unit === 'kg' ? 'cm' : 'in');

/** Default +/- increment for weight steppers. */
export const weightStep = (unit: Unit) => (unit === 'kg' ? 2.5 : 5);

/** Trims trailing zeros: 80 → "80", 82.5 → "82.5", 102.058 → "102.06". */
export function formatNumber(value: number, maxDecimals = 2): string {
  return round(value, maxDecimals).toLocaleString(undefined, {
    maximumFractionDigits: maxDecimals,
  });
}

/** Plain (non-localized) number for input fields. */
export function inputNumber(value: number | null, maxDecimals = 2): string {
  return value === null ? '' : String(round(value, maxDecimals));
}

export function displayWeight(kg: number | null, unit: Unit): number | null {
  return kg === null ? null : round(toDisplayWeight(kg, unit), 2);
}

export function formatWeight(kg: number, unit: Unit, withUnit = true, decimals = 2): string {
  const n = formatNumber(toDisplayWeight(kg, unit), decimals);
  return withUnit ? `${n} ${unit}` : n;
}

/** Large tonnage values: 12 345 kg → "12.3k kg". */
export function formatVolume(kg: number, unit: Unit, withUnit = true): string {
  const v = toDisplayWeight(kg, unit);
  const n =
    v >= 1_000_000
      ? `${formatNumber(v / 1_000_000, 2)}M`
      : v >= 10_000
        ? `${formatNumber(v / 1000, 1)}k`
        : formatNumber(v, 0);
  return withUnit ? `${n} ${unit}` : n;
}
