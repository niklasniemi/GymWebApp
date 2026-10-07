import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Dumbbell } from 'lucide-react';
import { ExerciseDetailHost } from './components/exercises/ExerciseDetail';
import { AmbientBackground } from './components/layout/AmbientBackground';
import { BottomNav } from './components/layout/BottomNav';
import { ConfirmHost } from './components/overlays/ConfirmHost';
import { Toaster } from './components/overlays/Toaster';
import { RestTimerBar } from './components/workout/RestTimerBar';
import { useAppearance } from './hooks/useAppearance';
import RoutinesPage from './pages/RoutinesPage';
import SettingsPage from './pages/SettingsPage';
import UtilitiesPage from './pages/UtilitiesPage';
import WorkoutPage from './pages/WorkoutPage';
import { useData } from './store/data';
import { useRoute, type Tab } from './store/ui';

// Recharts is the heaviest dependency — kept out of the startup bundle and
// prefetched once the app is idle, so the Analytics tab still opens instantly.
const loadAnalytics = () => import('./pages/AnalyticsPage');
const AnalyticsPage = lazy(loadAnalytics);

const PAGES: Record<Tab, ComponentType> = {
  workout: WorkoutPage,
  routines: RoutinesPage,
  analytics: AnalyticsPage,
  utilities: UtilitiesPage,
  settings: SettingsPage,
};

export function App() {
  useAppearance();
  const status = useData((s) => s.status);
  const route = useRoute();

  useEffect(() => {
    void useData.getState().init();
    const idle = window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));
    idle(() => void loadAnalytics());
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [route]);

  const Page = PAGES[route];

  return (
    <MotionConfig reducedMotion="user">
      <AmbientBackground />
      <a
        href="#main"
        className="sr-only z-[70] rounded-xl bg-accent px-4 py-3 font-semibold text-accent-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <main
        id="main"
        className="mx-auto w-full max-w-2xl px-4 pt-[env(safe-area-inset-top)] pb-[calc(max(env(safe-area-inset-bottom),0.75rem)+10rem)] lg:max-w-3xl lg:pb-28"
      >
        {status === 'loading' && <Splash />}
        {status === 'error' && <LoadError />}
        {status === 'ready' && (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={route}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            >
              <Suspense fallback={<PageSkeleton />}>
                <Page />
              </Suspense>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
      <RestTimerBar />
      <Toaster />
      <ExerciseDetailHost />
      <ConfirmHost />
    </MotionConfig>
  );
}

function Splash() {
  return (
    <div className="grid min-h-[70dvh] place-items-center" aria-busy="true" aria-label="Loading">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="grid size-16 place-items-center rounded-3xl bg-accent-soft text-accent-text"
      >
        <Dumbbell size={30} aria-hidden />
      </motion.div>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-4 pt-6" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-40 animate-pulse rounded-xl bg-fill" />
      <div className="h-10 animate-pulse rounded-xl bg-fill" />
      <div className="h-56 animate-pulse rounded-2xl bg-fill" />
      <div className="h-40 animate-pulse rounded-2xl bg-fill" />
    </div>
  );
}

function LoadError() {
  return (
    <div role="alert" className="grid min-h-[70dvh] place-items-center text-center">
      <div className="max-w-xs space-y-3">
        <h1 className="text-xl font-bold">Couldn't open your data</h1>
        <p className="text-sm text-fg-2">
          Storage may be blocked in this browser mode. Try reloading, or disable private browsing.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="min-h-12 rounded-xl bg-accent px-5 font-semibold text-accent-fg active:scale-95"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
