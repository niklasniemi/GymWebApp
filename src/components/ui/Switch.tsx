import { useId, type ReactNode } from 'react';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

/** Full-row toggle: the whole row is the 48px+ hit target. */
export function SwitchRow({ checked, onChange, label, description, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex min-h-14 items-center gap-4 py-2">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <span className="block text-[15px] font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-fg-2">{description}</span>}
      </label>
      <Switch id={id} checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

export function Switch({
  id,
  checked,
  onChange,
  disabled,
  ariaLabel,
}: {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        haptic('select');
        onChange(!checked);
      }}
      className="relative h-[31px] w-[51px] shrink-0 overflow-hidden rounded-full bg-fill-strong transition-transform active:scale-95 disabled:opacity-40"
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-0 rounded-full bg-success transition-opacity duration-200',
          checked ? 'opacity-100' : 'opacity-0',
        )}
      />
      <span
        aria-hidden
        className={cn(
          'absolute top-[2px] left-[2px] size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_1px_1px_rgb(0_0_0/0.16)]',
          'transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]',
          checked ? 'translate-x-5' : 'translate-x-0',
        )}
      />
    </button>
  );
}
