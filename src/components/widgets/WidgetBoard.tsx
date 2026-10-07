import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion, Reorder, useDragControls } from 'framer-motion';
import { ChevronRight, GripVertical, MinusCircle, PlusCircle, RotateCcw, type LucideIcon } from 'lucide-react';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';
import { useDashboard, type BoardId } from '../../store/dashboard';
import { Button } from '../ui/Button';

export interface WidgetDef {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  render: () => ReactNode;
}

interface Props {
  board: BoardId;
  widgets: WidgetDef[];
  defaults: string[];
  editing: boolean;
  onDone: () => void;
  /** Widget id to scroll to and briefly highlight (deep links). */
  focus?: string;
}

const widgetDomId = (board: BoardId, id: string) => `widget-${board}-${id}`;

/**
 * A page made of user-arranged widgets. View mode renders them in order;
 * edit mode collapses them into a reorderable list with remove / add.
 */
export function WidgetBoard({ board, widgets, defaults, editing, onDone, focus }: Props) {
  const stored = useDashboard((s) => s.layouts[board]);
  const setLayout = useDashboard((s) => s.setLayout);
  const reset = useDashboard((s) => s.reset);
  const byId = useMemo(() => new Map(widgets.map((w) => [w.id, w])), [widgets]);
  const layout = useMemo(() => (stored ?? defaults).filter((id) => byId.has(id)), [stored, defaults, byId]);
  const hidden = widgets.filter((w) => !layout.includes(w.id));

  // Deep link: scroll the focused widget into view and pulse it.
  const [pulse, setPulse] = useState<string | null>(null);
  useEffect(() => {
    if (!focus || editing) return;
    const el = document.getElementById(widgetDomId(board, focus));
    if (!el) return;
    const t1 = setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPulse(focus);
    }, 250);
    const t2 = setTimeout(() => setPulse(null), 1800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [focus, board, editing]);

  if (editing) {
    return (
      <EditBoard
        layout={layout}
        hidden={hidden}
        byId={byId}
        onChange={(ids) => setLayout(board, ids)}
        onReset={() => {
          haptic('tap');
          reset(board);
        }}
        onDone={onDone}
      />
    );
  }

  if (!layout.length) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-line p-8 text-center text-sm text-fg-2">
        All widgets are hidden. Tap <span className="font-semibold text-fg">Edit</span> to add some back.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {layout.map((id) => (
        <div
          key={id}
          id={widgetDomId(board, id)}
          className={cn(
            'scroll-mt-20 rounded-3xl',
            pulse === id && 'ring-2 ring-accent-text ring-offset-4 ring-offset-[var(--bg)]',
          )}
        >
          {byId.get(id)?.render()}
        </div>
      ))}
    </div>
  );
}

function EditBoard({
  layout,
  hidden,
  byId,
  onChange,
  onReset,
  onDone,
}: {
  layout: string[];
  hidden: WidgetDef[];
  byId: Map<string, WidgetDef>;
  onChange: (ids: string[]) => void;
  onReset: () => void;
  onDone: () => void;
}) {
  const move = (id: string, dir: -1 | 1) => {
    const i = layout.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= layout.length) return;
    const next = layout.slice();
    [next[i], next[j]] = [next[j], next[i]];
    haptic('select');
    onChange(next);
  };

  return (
    <div className="space-y-5">
      <p className="px-1 text-sm text-fg-2">Drag to reorder. Remove what you don't need and add what you do.</p>

      <section aria-label="Shown widgets">
        <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-fg-2 uppercase">Shown</h2>
        {layout.length === 0 ? (
          <p className="rounded-2xl bg-fill p-4 text-center text-sm text-fg-2">No widgets shown.</p>
        ) : (
          <Reorder.Group axis="y" values={layout} onReorder={onChange} className="space-y-2">
            {layout.map((id, i) => {
              const def = byId.get(id);
              return def ? (
                <EditItem
                  key={id}
                  def={def}
                  index={i}
                  count={layout.length}
                  onMove={(dir) => move(id, dir)}
                  onRemove={() => {
                    haptic('tap');
                    onChange(layout.filter((x) => x !== id));
                  }}
                />
              ) : null;
            })}
          </Reorder.Group>
        )}
      </section>

      <section aria-label="Available widgets">
        <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-fg-2 uppercase">Add widgets</h2>
        {hidden.length === 0 ? (
          <p className="rounded-2xl bg-fill p-4 text-center text-sm text-fg-2">Every widget is already shown.</p>
        ) : (
          <ul className="space-y-2">
            <AnimatePresence initial={false}>
              {hidden.map((def) => (
                <motion.li
                  key={def.id}
                  layout
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      haptic('success');
                      onChange([...layout, def.id]);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-line p-3 text-left transition-transform active:scale-[0.98]"
                  >
                    <PlusCircle size={22} className="shrink-0 text-success" aria-hidden />
                    <WidgetLabel def={def} />
                    <span className="sr-only">Add</span>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <div className="flex gap-2">
        <Button icon={RotateCcw} onClick={onReset}>
          Reset
        </Button>
        <Button variant="primary" block onClick={onDone} feedback="success">
          Done
        </Button>
      </div>
    </div>
  );
}

function WidgetLabel({ def }: { def: WidgetDef }) {
  const Icon = def.icon;
  return (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text">
        <Icon size={19} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{def.title}</span>
        <span className="block truncate text-xs text-fg-2">{def.description}</span>
      </span>
    </>
  );
}

function EditItem({
  def,
  index,
  count,
  onMove,
  onRemove,
}: {
  def: WidgetDef;
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault();
      onMove(-1);
    } else if (e.key === 'ArrowDown' && index < count - 1) {
      e.preventDefault();
      onMove(1);
    }
  };
  return (
    <Reorder.Item
      value={def.id}
      dragListener={false}
      dragControls={controls}
      onDragStart={() => haptic('select')}
      style={{ position: 'relative' }}
      whileDrag={{ scale: 1.03, zIndex: 10 }}
      className="surface flex list-none items-center gap-2 rounded-2xl p-2"
    >
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${def.title}`}
        className="grid size-10 shrink-0 place-items-center rounded-xl text-danger transition-transform active:scale-90"
      >
        <MinusCircle size={22} aria-hidden />
      </button>
      <WidgetLabel def={def} />
      <button
        type="button"
        aria-label={`Reorder ${def.title}. Use arrow keys to move. Position ${index + 1} of ${count}.`}
        onPointerDown={(e) => controls.start(e)}
        onKeyDown={onKey}
        className="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-xl text-muted active:cursor-grabbing"
      >
        <GripVertical size={20} aria-hidden />
      </button>
    </Reorder.Item>
  );
}

/** Standard widget chrome: title row with an optional "open" link, then content. */
export function WidgetFrame({
  title,
  action,
  onAction,
  children,
}: {
  title: string;
  /** Link label, e.g. "Details". */
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-2 flex min-h-8 items-end justify-between gap-3 px-1">
        <h2 className="text-[13px] font-semibold tracking-wide text-fg-2 uppercase">{title}</h2>
        {action && onAction && (
          <button
            type="button"
            onClick={() => {
              haptic('tap');
              onAction();
            }}
            className="flex min-h-8 items-center gap-0.5 text-sm font-semibold text-accent-text"
          >
            {action} <ChevronRight size={16} aria-hidden />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
