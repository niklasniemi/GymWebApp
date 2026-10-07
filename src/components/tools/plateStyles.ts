import type { Unit } from '../../types';

interface PlateStyle {
  color: string;
  h: number;
  w: number;
  light?: boolean;
}

const KG_STYLE: Record<string, PlateStyle> = {
  '25': { color: '#d03b3b', h: 128, w: 24 },
  '20': { color: '#2a78d6', h: 128, w: 21 },
  '15': { color: '#eda100', h: 118, w: 18 },
  '10': { color: '#008300', h: 104, w: 15 },
  '5': { color: '#f2f2ef', h: 78, w: 12, light: true },
  '2.5': { color: '#e34948', h: 60, w: 10 },
  '1.25': { color: '#a8a29e', h: 48, w: 8 },
};

const LB_STYLE: Record<string, PlateStyle> = {
  '45': { color: '#2a78d6', h: 128, w: 21 },
  '35': { color: '#eda100', h: 118, w: 18 },
  '25': { color: '#008300', h: 104, w: 15 },
  '10': { color: '#f2f2ef', h: 78, w: 12, light: true },
  '5': { color: '#e34948', h: 60, w: 10 },
  '2.5': { color: '#a8a29e', h: 48, w: 8 },
};

export function plateStyle(plate: number, unit: Unit): PlateStyle {
  return (unit === 'kg' ? KG_STYLE : LB_STYLE)[String(plate)] ?? { color: '#78716c', h: 70, w: 12 };
}
