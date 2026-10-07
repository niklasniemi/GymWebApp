import type { ComponentProps, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { haptic, type HapticKind } from '../../lib/haptics';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'soft' | 'danger' | 'success';
type Size = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  block?: boolean;
  /** Haptic tick on press; false to disable. */
  feedback?: HapticKind | false;
  children?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg shadow-sm',
  secondary: 'bg-fill text-fg hover:bg-fill-strong',
  ghost: 'text-fg-2 hover:bg-fill',
  soft: 'bg-accent-soft text-accent-text',
  danger: 'bg-danger-soft text-danger',
  success: 'bg-success text-white shadow-sm',
};

const SIZES: Record<Size, string> = {
  sm: 'min-h-10 px-3 text-sm gap-1.5 rounded-xl',
  md: 'min-h-12 px-4 text-[15px] gap-2 rounded-xl',
  lg: 'min-h-14 px-5 text-base gap-2 rounded-2xl',
  icon: 'size-12 rounded-xl',
  'icon-sm': 'size-10 rounded-xl',
};

const ICON_SIZES: Record<Size, number> = { sm: 16, md: 18, lg: 20, icon: 20, 'icon-sm': 18 };

export function Button({
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  iconRight: IconRight,
  block,
  feedback = 'tap',
  className,
  children,
  onClick,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold whitespace-nowrap',
        'transition-transform duration-150 ease-out active:scale-95',
        'disabled:pointer-events-none disabled:opacity-40',
        VARIANTS[variant],
        SIZES[size],
        // Block buttons share a row evenly; inline ones keep their size.
        block ? 'w-full min-w-0 flex-1' : 'shrink-0',
        className,
      )}
      onClick={(e) => {
        if (feedback) haptic(feedback);
        onClick?.(e);
      }}
      {...rest}
    >
      {Icon && <Icon size={ICON_SIZES[size]} strokeWidth={2.25} aria-hidden />}
      {children}
      {IconRight && <IconRight size={ICON_SIZES[size]} strokeWidth={2.25} aria-hidden />}
    </button>
  );
}
