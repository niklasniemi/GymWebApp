import { useEffect, useRef, useState } from 'react';
import {
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Raycaster,
  RingGeometry,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three';
import { Pause, Play } from 'lucide-react';
import { MUSCLE_FACING, MUSCLES, type Muscle } from '../../data/anatomy';
import { useIsDark } from '../../hooks/useIsDark';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useSettings } from '../../store/settings';
import { haptic } from '../../lib/haptics';
import type { MuscleLoad } from '../../lib/muscles';
import { cn } from '../../lib/utils';
import { BODY_HEIGHT, createBodyGeometry, loadBodyAsset, type BodyAsset } from './bodyAsset';
import { bodyTheme, createBodyMaterials } from './bodyMaterial';
import { vertexHeat } from './bodyRig';

export interface BodyHeatmapProps {
  /** 0–1 per muscle. */
  heat: MuscleLoad;
  height?: number;
  selected?: Muscle | null;
  onSelect?: (muscle: Muscle | null) => void;
  /** Accessible summary of what the map shows. */
  label: string;
  /** Turn to face a muscle (e.g. picked from a list). A new object = a new request. */
  focus?: { muscle: Muscle } | null;
  className?: string;
}

const TAU = Math.PI * 2;
const AUTO_SPEED = 0.42; // rad/s
const IDLE_BEFORE_AUTO = 2500; // ms
const CAMERA_DISTANCE = 5.6;
const BASE_FOV = 22;

type Status = 'loading' | 'ready' | 'failed';

interface Interaction {
  rotation: number;
  velocity: number;
  target: number | null;
  dragging: boolean;
  pointerId: number | null;
  startX: number;
  lastX: number;
  lastT: number;
  moved: boolean;
  lastInteraction: number;
  dirty: boolean;
}

/**
 * Rotating, translucent 3D muscle heat map. Default export so three.js and
 * the model are code-split and fetched only when a body map is first shown.
 *
 * Perf: renders only while on screen and only when something changed; drag
 * rotates horizontally while `touch-action: pan-y` keeps page scrolling free.
 */
export default function BodyHeatmap({
  heat,
  height = 360,
  selected = null,
  onSelect,
  label,
  focus = null,
  className,
}: BodyHeatmapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const dark = useIsDark();
  const accent = useSettings((s) => s.accent);
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [status, setStatus] = useState<Status>('loading');
  const [spinning, setSpinning] = useState(!reducedMotion);
  const [facing, setFacing] = useState<'front' | 'back'>('front');

  // A focus request stops auto-rotation and turns the body to that muscle.
  const [seenFocus, setSeenFocus] = useState(focus);
  if (focus !== seenFocus) {
    setSeenFocus(focus);
    if (focus) {
      setFacing(MUSCLE_FACING[focus.muscle]);
      setSpinning(false);
    }
  }

  // Live values for the render loop and event handlers.
  const latest = useRef({ heat, dark, selected, onSelect, spinning });
  useEffect(() => {
    latest.current = { heat, dark, selected, onSelect, spinning };
  });

  const api = useRef<{
    applyHeat: () => void;
    applyLook: () => void;
    face: (side: 'front' | 'back') => void;
    wake: () => void;
  } | null>(null);

  // ---- Scene lifecycle (mount once) ---------------------------------------
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      queueMicrotask(() => setStatus('failed'));
      return;
    }
    let disposed = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const canvas = renderer.domElement;
    Object.assign(canvas.style, { touchAction: 'pan-y', display: 'block', cursor: 'grab' });
    canvas.setAttribute('aria-hidden', 'true');
    host.prepend(canvas);

    const scene = new Scene();
    const camera = new PerspectiveCamera(BASE_FOV, 1, 0.1, 30);
    camera.position.set(0, 1.0, CAMERA_DISTANCE);
    camera.lookAt(0, 0.86, 0);

    const materials = createBodyMaterials();
    const root = new Group();
    scene.add(root);

    // Hologram pedestal: a glowing ring and a faint disc under the feet.
    const ringMat = new MeshBasicMaterial({ transparent: true, opacity: 0.55, depthWrite: false });
    const haloMat = new MeshBasicMaterial({ transparent: true, opacity: 0.22, depthWrite: false });
    const discMat = new MeshBasicMaterial({ transparent: true, opacity: 0.07, depthWrite: false });
    const pedestal = new Group();
    pedestal.rotation.x = -Math.PI / 2;
    pedestal.position.y = 0.002;
    pedestal.add(new Mesh(new RingGeometry(0.44, 0.455, 96), ringMat));
    pedestal.add(new Mesh(new RingGeometry(0.52, 0.525, 96), haloMat));
    pedestal.add(new Mesh(new CircleGeometry(0.44, 64), discMat));
    scene.add(pedestal);

    let asset: BodyAsset | null = null;
    let front: Mesh | null = null;
    let heatAttr: ReturnType<typeof createBodyGeometry>['heat'] | null = null;
    let disposeGeometry: (() => void) | null = null;

    const state: Interaction = {
      rotation: 0,
      velocity: 0,
      target: null,
      dragging: false,
      pointerId: null,
      startX: 0,
      lastX: 0,
      lastT: 0,
      moved: false,
      lastInteraction: 0,
      dirty: true,
    };

    const heatValues = new Float32Array(MUSCLES.length);
    const applyHeat = () => {
      if (!asset || !heatAttr) return;
      MUSCLES.forEach((m, i) => (heatValues[i] = latest.current.heat[m]));
      vertexHeat(asset.ids, heatValues, asset.adjacency, heatAttr.array as Float32Array);
      heatAttr.needsUpdate = true;
      state.dirty = true;
    };

    const applyLook = () => {
      const { dark: d, selected: sel } = latest.current;
      const theme = bodyTheme(d);
      materials.setTheme(theme);
      materials.setSelected(sel ? MUSCLES.indexOf(sel) + 1 : -1);
      for (const m of [ringMat, haloMat, discMat]) m.color.set(theme.rim);
      state.dirty = true;
    };
    applyLook();

    loadBodyAsset()
      .then((a) => {
        if (disposed) return;
        asset = a;
        const { geometry, heat: h } = createBodyGeometry(a);
        heatAttr = h;
        disposeGeometry = () => geometry.dispose();
        const back = new Mesh(geometry, materials.back);
        back.renderOrder = 0;
        front = new Mesh(geometry, materials.front);
        front.renderOrder = 1;
        root.add(back, front);
        applyHeat();
        setStatus('ready');
      })
      .catch((err) => {
        console.error('[forge] body model failed to load', err);
        if (!disposed) setStatus('failed');
      });

    // ---- Sizing ------------------------------------------------------------
    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      camera.aspect = w / h;
      // Fit both the height and the A-pose arm span (~0.85 × height).
      const halfWidth = (BODY_HEIGHT * 0.45) / CAMERA_DISTANCE;
      const fovForWidth = (2 * Math.atan(halfWidth / camera.aspect) * 180) / Math.PI;
      camera.fov = Math.max(BASE_FOV, fovForWidth);
      camera.updateProjectionMatrix();
      state.dirty = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // ---- Render loop (only while visible) -----------------------------------
    let last = performance.now();
    let visible = true;
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!state.dragging) {
        if (state.target !== null) {
          const diff = state.target - state.rotation;
          state.rotation += diff * Math.min(1, dt * 7);
          if (Math.abs(diff) < 0.002) {
            state.rotation = state.target;
            state.target = null;
          }
          state.dirty = true;
        } else if (Math.abs(state.velocity) > 0.01) {
          state.rotation += state.velocity * dt;
          state.velocity *= Math.pow(0.9, dt * 60);
          state.dirty = true;
        } else if (latest.current.spinning && now - state.lastInteraction > IDLE_BEFORE_AUTO) {
          state.rotation += AUTO_SPEED * dt;
          state.dirty = true;
        }
      }
      if (state.dirty) {
        root.rotation.y = state.rotation;
        renderer.render(scene, camera);
        state.dirty = false;
      }
    };
    const updateLoop = () => {
      renderer.setAnimationLoop(visible && document.visibilityState === 'visible' ? tick : null);
    };
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      last = performance.now();
      updateLoop();
    });
    io.observe(host);
    document.addEventListener('visibilitychange', updateLoop);
    updateLoop();

    // ---- Interaction -------------------------------------------------------
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const pick = (clientX: number, clientY: number): Muscle | null => {
      if (!front || !asset) return null;
      const rect = canvas.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const [hit] = raycaster.intersectObject(front, false);
      if (!hit?.face) return null;
      // Majority vote of the triangle's three vertices.
      const ids = [hit.face.a, hit.face.b, hit.face.c].map((i) => asset!.ids[i]);
      const id = ids[0] === ids[1] || ids[0] === ids[2] ? ids[0] : ids[1] === ids[2] ? ids[1] : ids[0];
      return id ? MUSCLES[id - 1] : null;
    };

    const onDown = (e: PointerEvent) => {
      if (state.pointerId !== null) return;
      state.pointerId = e.pointerId;
      state.startX = state.lastX = e.clientX;
      state.lastT = performance.now();
      state.moved = false;
      state.velocity = 0;
      state.target = null;
      state.lastInteraction = performance.now();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== state.pointerId) return;
      const dx = e.clientX - state.lastX;
      if (!state.moved && Math.abs(e.clientX - state.startX) > 6) {
        state.moved = true;
        state.dragging = true;
        canvas.setPointerCapture(e.pointerId);
        canvas.style.cursor = 'grabbing';
      }
      if (state.dragging) {
        const now = performance.now();
        const dRot = dx * 0.011;
        state.rotation += dRot;
        state.velocity = dRot / Math.max(0.008, (now - state.lastT) / 1000);
        state.lastT = now;
        state.lastInteraction = now;
        state.dirty = true;
      }
      state.lastX = e.clientX;
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== state.pointerId) return;
      state.pointerId = null;
      canvas.style.cursor = 'grab';
      if (state.dragging) {
        state.dragging = false;
        if (performance.now() - state.lastT > 80) state.velocity = 0;
      } else if (!state.moved && latest.current.onSelect) {
        const m = pick(e.clientX, e.clientY);
        const next = m && m !== latest.current.selected ? m : null;
        haptic('select');
        latest.current.onSelect(next);
      }
      state.lastInteraction = performance.now();
    };
    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== state.pointerId) return;
      state.pointerId = null;
      state.dragging = false;
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);

    const onLost = (e: Event) => {
      e.preventDefault();
      setStatus('failed');
    };
    canvas.addEventListener('webglcontextlost', onLost);

    api.current = {
      applyHeat,
      applyLook,
      face: (side) => {
        // Rotate the shortest way to the front (0) or back (π).
        const base = side === 'front' ? 0 : Math.PI;
        const turns = Math.round((state.rotation - base) / TAU);
        state.target = base + turns * TAU;
        state.velocity = 0;
        state.lastInteraction = performance.now();
        state.dirty = true;
      },
      wake: () => {
        state.lastInteraction = 0;
        state.dirty = true;
      },
    };

    return () => {
      disposed = true;
      api.current = null;
      renderer.setAnimationLoop(null);
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', updateLoop);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.removeEventListener('webglcontextlost', onLost);
      disposeGeometry?.();
      materials.dispose();
      pedestal.traverse((o) => (o as Mesh).geometry?.dispose());
      [ringMat, haloMat, discMat].forEach((m) => m.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, []);

  // ---- Prop-driven updates ------------------------------------------------
  useEffect(() => {
    api.current?.applyHeat();
  }, [heat]);

  useEffect(() => {
    // Next frame: the app shell applies the new accent to <html> after child effects run.
    const raf = requestAnimationFrame(() => api.current?.applyLook());
    return () => cancelAnimationFrame(raf);
  }, [dark, selected, accent]);

  useEffect(() => {
    if (focus) api.current?.face(MUSCLE_FACING[focus.muscle]);
  }, [focus]);

  useEffect(() => {
    if (spinning) api.current?.wake();
  }, [spinning]);

  const face = (side: 'front' | 'back') => {
    haptic('select');
    setFacing(side);
    setSpinning(false);
    api.current?.face(side);
  };

  return (
    <div className={cn('relative select-none', className)} style={{ height }}>
      <div ref={hostRef} role="img" aria-label={label} className="absolute inset-0 overflow-hidden rounded-2xl" />
      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-3/4 w-1/3 animate-pulse rounded-[40%] bg-fill" aria-hidden />
          <span className="sr-only">Loading 3D body model…</span>
        </div>
      )}
      {status === 'failed' && (
        <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-fg-2">
          3D view isn't available right now. The muscle list below shows the same data.
        </p>
      )}
      {status !== 'failed' && (
        <div className="absolute right-2 bottom-2 left-2 flex items-center justify-between gap-2">
          <div className="flex rounded-full bg-fill p-0.5 text-xs font-semibold" role="group" aria-label="View side">
            {(['front', 'back'] as const).map((side) => (
              <button
                key={side}
                type="button"
                aria-pressed={!spinning && facing === side}
                onClick={() => face(side)}
                className={cn(
                  'min-h-9 rounded-full px-3 capitalize transition-transform active:scale-95',
                  !spinning && facing === side ? 'bg-surface text-fg shadow-sm dark:bg-surface-3' : 'text-fg-2',
                )}
              >
                {side}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              haptic('select');
              setSpinning((v) => !v);
            }}
            aria-label={spinning ? 'Pause rotation' : 'Rotate automatically'}
            aria-pressed={spinning}
            className="grid size-9 place-items-center rounded-full bg-fill text-fg-2 transition-transform active:scale-90"
          >
            {spinning ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
          </button>
        </div>
      )}
    </div>
  );
}
