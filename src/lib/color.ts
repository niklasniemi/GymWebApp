/** Resolves a CSS custom property (e.g. `--accent`) to the browser's computed `rgb(…)` string. */
export function cssColor(varName: string): string {
  const probe = document.createElement('span');
  probe.style.cssText = `display:none;color:var(${varName})`;
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

/** Parses `rgb(…)`, `rgba(…)` or `#rrggbb`. */
export function parseRgb(color: string): [number, number, number] | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(color);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** Mixes two colours (t = 0 → a, 1 → b) and returns #rrggbb. */
export function mixColors(a: string, b: string, t: number): string {
  const ca = parseRgb(a) ?? [128, 128, 128];
  const cb = parseRgb(b) ?? [128, 128, 128];
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
