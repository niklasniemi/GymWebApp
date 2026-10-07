import { memo, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface FlameProps {
  /** 0–100 momentum. */
  level: number;
  /** Rendered size in px (height; width is 0.75×). */
  size?: number;
  /** Increment to trigger a spark burst + flare. */
  burst?: number;
  /** Show rising embers (off for tiny inline flames). */
  embers?: boolean;
}

/*
 * Layered SVG flame. Height and brightness follow the level: embers at 0,
 * a roaring white-hot core near 100. Flicker is pure CSS transform/opacity
 * keyframes (see index.css), paused while off-screen.
 */
export const Flame = memo(function Flame({ level, size = 140, burst = 0, embers = true }: FlameProps) {
  const id = useId().replace(/:/g, '');
  const ref = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setPaused(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const t = Math.max(0, Math.min(1, level / 100));
  // Flame grows with momentum; never fully disappears (a coal keeps glowing).
  const scale = 0.22 + 0.78 * Math.pow(t, 0.8);
  const coreOpacity = 0.35 + 0.65 * t;
  const emberCount = embers ? Math.round(2 + t * 10) : 0;
  const particles = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        // Deterministic pseudo-random so embers don't jump between renders.
        const r = (n: number) => (((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1) + 1) % 1;
        return {
          left: 30 + r(1) * 40,
          dx: (r(2) - 0.5) * 40,
          rise: -(60 + r(3) * 70),
          duration: 1.4 + r(4) * 1.4,
          delay: r(5) * 2.2,
          size: 2 + r(6) * 3,
        };
      }),
    [],
  );

  return (
    <div ref={ref} data-paused={paused} className="relative" style={{ width: size * 0.75, height: size }} aria-hidden>
      {/* Embers */}
      {particles.slice(0, emberCount).map((p, i) => (
        <span
          key={i}
          className="flame-ember"
          style={
            {
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              background: i % 3 ? '#fbbf24' : '#fb923c',
              boxShadow: '0 0 6px #f97316',
              '--ember-dx': `${p.dx}px`,
              '--ember-rise': `${p.rise * (0.5 + t * 0.6)}px`,
              '--ember-duration': `${p.duration}s`,
              '--ember-delay': `${p.delay}s`,
            } as CSSProperties
          }
        />
      ))}

      <motion.svg
        key={burst}
        viewBox="0 0 120 160"
        className="absolute inset-0 h-full w-full overflow-visible"
        initial={burst ? { scale: 1 } : false}
        animate={burst ? { scale: [1, 1.28, 0.96, 1] } : { scale: 1 }}
        transition={{ duration: 0.7, times: [0, 0.25, 0.6, 1], ease: 'easeOut' }}
        style={{ originX: 0.5, originY: 1 }}
      >
        <defs>
          <radialGradient id={`${id}-glow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fb923c" stopOpacity="0.75" />
            <stop offset="55%" stopColor="#f97316" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`${id}-outer`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#991b1b" />
            <stop offset="45%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id={`${id}-mid`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#ea580c" />
            <stop offset="60%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id={`${id}-core`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#fde68a" />
            <stop offset="100%" stopColor="#fffbeb" />
          </linearGradient>
        </defs>

        {/* Glow + coal bed (always visible, so even embers look alive) */}
        <ellipse
          className="flame-glow"
          cx="60"
          cy={150 - 70 * scale}
          rx={30 + 40 * scale}
          ry={30 + 60 * scale}
          fill={`url(#${id}-glow)`}
          opacity={0.35 + 0.65 * t}
        />
        <ellipse cx="60" cy="152" rx="26" ry="6" fill="#7c2d12" opacity={0.5} />
        <ellipse className="flame-glow" cx="60" cy="151" rx="18" ry="4" fill="#f97316" opacity={0.6 + 0.4 * t} />

        <g
          style={{
            transform: `scale(${scale})`,
            transformOrigin: '60px 156px',
            transition: 'transform 900ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <path
            className="flame-layer flame-outer"
            fill={`url(#${id}-outer)`}
            d="M60 4C66 30 96 46 100 88C104 128 84 156 60 156C36 156 16 130 20 92C23 66 38 56 44 36C48 48 52 54 56 60C58 40 54 22 60 4Z"
          />
          <path
            className="flame-layer flame-mid"
            fill={`url(#${id}-mid)`}
            d="M62 36C68 60 88 72 88 104C88 132 74 150 60 150C46 150 32 134 32 108C32 88 44 80 48 66C52 78 56 84 60 88C62 70 58 54 62 36Z"
          />
          <path
            className="flame-layer flame-core"
            fill={`url(#${id}-core)`}
            opacity={coreOpacity}
            d="M60 78C66 94 76 104 76 122C76 138 68 148 60 148C52 148 44 138 44 124C44 110 54 102 56 92C58 98 60 100 60 102C61 94 58 86 60 78Z"
          />
        </g>
      </motion.svg>

      {/* Spark burst on tap */}
      <AnimatePresence>{burst > 0 && <Sparks key={burst} />}</AnimatePresence>
    </div>
  );
});

const SPARKS = Array.from({ length: 22 }, (_, i) => {
  const angle = -Math.PI / 2 + ((i / 22) * 2 - 1) * (Math.PI * 0.55) + (i % 2 ? 0.1 : -0.1);
  const dist = 50 + (i % 5) * 16;
  return {
    x: Math.cos(angle) * dist,
    y: Math.sin(angle) * dist,
    fall: 18 + (i % 4) * 8,
    size: 3 + (i % 3),
    color: ['#fde68a', '#fbbf24', '#fb923c', '#ffffff'][i % 4],
    delay: (i % 6) * 0.015,
  };
});

function Sparks() {
  return (
    <div className="pointer-events-none absolute left-1/2 top-[55%]">
      {SPARKS.map((s, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            width: s.size,
            height: s.size,
            marginLeft: -s.size / 2,
            marginTop: -s.size / 2,
            background: s.color,
            boxShadow: `0 0 8px ${s.color}`,
          }}
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: s.x, y: [0, s.y, s.y + s.fall], opacity: [1, 1, 0], scale: [1, 1, 0.3] }}
          transition={{ duration: 0.9, delay: s.delay, ease: 'easeOut', times: [0, 0.6, 1] }}
        />
      ))}
    </div>
  );
}
