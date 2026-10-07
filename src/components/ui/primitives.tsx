import type { ComponentProps, ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';

export function Card({ className, padded = true, ...rest }: ComponentProps<'div'> & { padded?: boolean }) {
  return <div className={cn('surface rounded-2xl', padded && 'p-4', className)} {...rest} />;
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-2 flex min-h-8 items-end justify-between gap-3 px-1', className)}>
      <h2 className="text-[13px] font-semibold tracking-wide text-fg-2 uppercase">{children}</h2>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex items-end justify-between gap-3 pt-4 pb-4 lg:pt-8">
      <div className="min-w-0">
        {subtitle && <p className="text-[13px] font-semibold tracking-wide text-fg-2 uppercase">{subtitle}</p>}
        <h1 className="truncate text-[32px] leading-tight font-bold tracking-tight">{title}</h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => {
        haptic('select');
        onClick();
      }}
      className={cn(
        'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold whitespace-nowrap transition-transform active:scale-95',
        selected ? 'bg-fg text-bg' : 'bg-fill text-fg-2',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'gold' | 'danger';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-fill text-fg-2',
    accent: 'bg-accent-soft text-accent-text',
    success: 'bg-success-soft text-success-text',
    gold: 'bg-gold-soft text-gold',
    danger: 'bg-danger-soft text-danger',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent-text">
        <Icon size={26} strokeWidth={2} aria-hidden />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {children && <p className="mt-1 max-w-xs text-sm text-fg-2">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn('surface rounded-2xl p-3.5', className)}>
      <div className="flex items-center gap-1.5 text-[12px] font-semibold tracking-wide text-fg-2 uppercase">
        {Icon && <Icon size={13} strokeWidth={2.5} aria-hidden className="shrink-0" />}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 truncate text-2xl font-bold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 truncate text-xs text-fg-2">{sub}</div>}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block px-1 text-[13px] font-semibold text-fg-2">
        {label}
      </label>
      {children}
      {hint && <p className="px-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function TextInput({ className, ...rest }: ComponentProps<'input'>) {
  return <input className={cn('field text-[16px]', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: ComponentProps<'select'>) {
  return (
    <div className={cn('relative', className)}>
      <select className="field appearance-none pr-10 text-[16px]" {...rest}>
        {children}
      </select>
      <ChevronDown
        size={18}
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-fg-2"
      />
    </div>
  );
}

export interface ActionItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

/** Vertical list of actions — used inside sheets as an accessible menu. */
export function ActionList({ items }: { items: ActionItem[] }) {
  return (
    <ul className="space-y-1 pb-2">
      {items.map(({ label, icon: Icon, onSelect, destructive, disabled }) => (
        <li key={label}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              haptic('tap');
              onSelect();
            }}
            className={cn(
              'flex min-h-13 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-medium transition-transform active:scale-[0.98] hover:bg-fill disabled:opacity-40',
              destructive ? 'text-danger' : 'text-fg',
            )}
          >
            <Icon size={20} strokeWidth={2} aria-hidden className={destructive ? '' : 'text-fg-2'} />
            {label}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-line', className)} />;
}
