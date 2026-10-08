import { memo, useId, type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatShortDate } from '../../lib/format';
import { niceRangeTicks, niceTicks } from '../../lib/analytics';
import { formatNumber } from '../../lib/units';

/*
 * Chart conventions (shared by every chart in the app):
 * 2px lines, ≤24px bars with 4px rounded data-ends, ~10% area wash, solid
 * hairline horizontal grid, recessive axes, text in text tokens (never the
 * series color), hover tooltip on every chart, legend only for ≥2 series.
 * Colors are CSS variables so light/dark swap without re-rendering.
 */

const AXIS_TICK = { fill: 'var(--chart-axis)', fontSize: 11 } as const;
const GRID = { stroke: 'var(--chart-grid)', strokeWidth: 1, vertical: false } as const;

export interface TimePoint {
  date: number;
  value: number;
  /** Marks a personal-record session (gold marker). */
  pr?: boolean;
}

interface TooltipRow {
  label: string;
  value: string;
  color: string;
}

function TooltipCard({ title, rows }: { title: string; rows: TooltipRow[] }) {
  return (
    <div className="surface-float min-w-32 rounded-xl px-3 py-2 text-[13px]">
      <p className="mb-1 font-semibold text-fg-2">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2">
          <span aria-hidden className="size-2 rounded-full" style={{ background: r.color }} />
          <span className="text-fg-2">{r.label}</span>
          <span className="ml-auto pl-3 font-semibold text-fg tabular">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

interface TipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown; name?: unknown; color?: string; dataKey?: unknown }>;
  label?: unknown;
  format: (v: number) => string;
  titleFormat: (label: unknown) => string;
  names: Record<string, string>;
}

/** Recharts clones this element and injects active/payload/label. */
function ChartTooltip({ active, payload, label, format, titleFormat, names }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <TooltipCard
      title={titleFormat(label)}
      rows={payload
        .filter((p) => typeof p.value === 'number')
        .map((p) => ({
          label: names[String(p.dataKey)] ?? String(p.name ?? ''),
          value: format(p.value as number),
          color: p.color ?? 'var(--chart-1)',
        }))}
    />
  );
}

const dateTitle = (l: unknown) => formatShortDate(Number(l));
const plainTitle = (l: unknown) => String(l);

export function ChartFrame({
  title,
  summary,
  children,
  table,
  height = 220,
  legend,
}: {
  title: string;
  summary?: ReactNode;
  children: ReactNode;
  table?: ReactNode;
  height?: number;
  legend?: ReactNode;
}) {
  return (
    <figure className="m-0">
      <figcaption className="sr-only">{title}</figcaption>
      {summary}
      {legend}
      <div style={{ height }} className="-mx-1">
        {children}
      </div>
      {table && <div className="sr-only">{table}</div>}
    </figure>
  );
}

/** Single-series trend over time (area wash + 2px line + labeled end dot). */
export const TrendChart = memo(function TrendChart({
  data,
  name,
  format,
  height = 220,
}: {
  data: TimePoint[];
  name: string;
  format: (v: number) => string;
  height?: number;
}) {
  const gradientId = useId().replace(/:/g, '');
  const last = data[data.length - 1];
  const values = data.map((d) => d.value);
  const ticks = niceRangeTicks(Math.min(...values), Math.max(...values));
  return (
    <ChartFrame
      title={`${name} over time`}
      height={height}
      legend={
        data.some((d) => d.pr) ? (
          <p className="mb-1 flex items-center gap-1.5 px-1 text-xs text-fg-2" aria-hidden>
            <span className="size-2 rounded-full bg-[var(--gold)]" /> Personal-record session
          </p>
        ) : undefined
      }
      table={
        <DataTable
          rows={data.map((d) => [formatShortDate(d.date), format(d.value), d.pr ? 'PR' : ''])}
          head={['Date', name, 'Record']}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 44, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.14} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid {...GRID} />
          <XAxis
            dataKey="date"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => formatShortDate(v)}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: 'var(--chart-grid)' }}
            minTickGap={28}
          />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={44}
            ticks={ticks}
            domain={[ticks[0], ticks[ticks.length - 1]]}
            tickFormatter={(v: number) => formatNumber(v, 1)}
          />
          <Tooltip
            content={<ChartTooltip format={format} titleFormat={dateTitle} names={{ value: name }} />}
            cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }}
          />
          <Area
            type="monotone"
            dataKey="value"
            name={name}
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 5, fill: 'var(--chart-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
          {data
            .filter((d) => d.pr && d !== last)
            .map((d) => (
              <ReferenceDot
                key={`pr-${d.date}`}
                x={d.date}
                y={d.value}
                r={4.5}
                fill="var(--gold)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
            ))}
          {last && (
            <ReferenceDot
              x={last.date}
              y={last.value}
              r={4}
              fill={last.pr ? 'var(--gold)' : 'var(--chart-1)'}
              stroke="var(--surface)"
              strokeWidth={2}
              label={{ value: format(last.value), position: 'right', fill: 'var(--fg)', fontSize: 12, fontWeight: 600 }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
});

/** Magnitude per period — capped-width columns with rounded data-ends. */
export const PeriodBarChart = memo(function PeriodBarChart({
  data,
  name,
  format,
  tickFormat,
  height = 220,
}: {
  data: { key: string; label: string; value: number }[];
  name: string;
  format: (v: number) => string;
  tickFormat?: (v: number) => string;
  height?: number;
}) {
  const ticks = niceTicks(Math.max(0, ...data.map((d) => d.value)));
  return (
    <ChartFrame
      title={`${name} per period`}
      height={height}
      table={<DataTable rows={data.map((d) => [d.label, format(d.value)])} head={['Period', name]} />}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid {...GRID} />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: 'var(--chart-grid)' }}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={44}
            ticks={ticks}
            domain={[0, ticks[ticks.length - 1]]}
            tickFormatter={tickFormat ?? ((v: number) => formatNumber(v, 0))}
          />
          <Tooltip
            content={<ChartTooltip format={format} titleFormat={plainTitle} names={{ value: name }} />}
            cursor={{ fill: 'var(--fill)' }}
          />
          <Bar
            dataKey="value"
            name={name}
            fill="var(--chart-1)"
            maxBarSize={24}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
});

/** Two series sharing one axis: raw measurements + smoothed trend. */
export const MeasuredTrendChart = memo(function MeasuredTrendChart({
  data,
  name,
  format,
  height = 240,
  target,
}: {
  data: { date: number; value: number; trend: number }[];
  name: string;
  format: (v: number) => string;
  height?: number;
  /** Optional goal value drawn as a dashed reference line. */
  target?: number;
}) {
  const values = data.flatMap((d) => [d.value, d.trend]);
  if (target !== undefined) values.push(target);
  const ticks = niceRangeTicks(Math.min(...values), Math.max(...values));
  return (
    <ChartFrame
      title={`${name} with trend line`}
      height={height}
      legend={
        <div className="mb-2 flex gap-4 px-1 text-xs text-fg-2" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[var(--chart-1)]" /> {name}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full bg-[var(--chart-2)]" /> Trend
          </span>
          {target !== undefined && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 border-t border-dashed border-[var(--success)]" /> Target
            </span>
          )}
        </div>
      }
      table={
        <DataTable
          rows={data.map((d) => [formatShortDate(d.date), format(d.value), format(d.trend)])}
          head={['Date', name, 'Trend']}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid {...GRID} />
          <XAxis
            dataKey="date"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => formatShortDate(v)}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={{ stroke: 'var(--chart-grid)' }}
            minTickGap={28}
          />
          <YAxis
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={44}
            ticks={ticks}
            domain={[ticks[0], ticks[ticks.length - 1]]}
            tickFormatter={(v: number) => formatNumber(v, 1)}
          />
          <Tooltip
            content={<ChartTooltip format={format} titleFormat={dateTitle} names={{ value: name, trend: 'Trend' }} />}
            cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }}
          />
          <Line
            type="linear"
            dataKey="value"
            name={name}
            stroke="var(--chart-1)"
            strokeOpacity={0.55}
            strokeWidth={1.5}
            dot={{ r: 4, fill: 'var(--chart-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
            activeDot={{ r: 6, fill: 'var(--chart-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
          {target !== undefined && (
            <ReferenceLine
              y={target}
              stroke="var(--success)"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              ifOverflow="extendDomain"
            />
          )}
          <Line
            type="monotone"
            dataKey="trend"
            name="Trend"
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
});

export function DataTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <table>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
