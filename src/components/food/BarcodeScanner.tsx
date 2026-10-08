import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CameraOff, Flashlight, FlashlightOff, Loader2, ScanBarcode } from 'lucide-react';
import { haptic } from '../../lib/haptics';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';

/*
 * Camera barcode scanner. Uses the native BarcodeDetector where available
 * (Chrome/Android), otherwise the ZXing WebAssembly ponyfill — loaded only
 * when the scanner opens, with the .wasm served from our own origin.
 */

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

interface Detector {
  detect(source: HTMLVideoElement): Promise<{ rawValue: string }[]>;
}

interface NativeDetectorCtor {
  new (opts: { formats: string[] }): Detector;
  getSupportedFormats(): Promise<string[]>;
}

async function createDetector(): Promise<Detector> {
  const Native = (window as unknown as { BarcodeDetector?: NativeDetectorCtor }).BarcodeDetector;
  if (Native) {
    try {
      const supported = await Native.getSupportedFormats();
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.length) return new Native({ formats });
    } catch {
      // fall through to the ponyfill
    }
  }
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import('barcode-detector/ponyfill'),
    import('zxing-wasm/reader/zxing_reader.wasm?url'),
  ]);
  prepareZXingModule({
    overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
  });
  return new BarcodeDetector({ formats: FORMATS as never[] }) as unknown as Detector;
}

type CameraState = 'starting' | 'scanning' | 'denied' | 'unavailable';

export default function BarcodeScanner({ onDetected }: { onDetected: (code: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const onDetectedRef = useRef(onDetected);
  const [state, setState] = useState<CameraState>('starting');
  const [torch, setTorch] = useState<boolean | null>(null);
  const [manual, setManual] = useState('');

  useEffect(() => {
    onDetectedRef.current = onDetected;
  });

  useEffect(() => {
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unavailable');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err) {
        if (!stopped) setState((err as DOMException).name === 'NotAllowedError' ? 'denied' : 'unavailable');
        return;
      }
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);
      const track = stream.getVideoTracks()[0];
      trackRef.current = track;
      const caps = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      if (caps?.torch) setTorch(false);

      let detector: Detector;
      try {
        detector = await createDetector();
      } catch {
        if (!stopped) setState('unavailable');
        return;
      }
      if (stopped) return;
      setState('scanning');

      const tick = async () => {
        if (stopped) return;
        if (video.readyState >= 2) {
          try {
            const codes = await detector.detect(video);
            const hit = codes.find((c) => /^\d{8,14}$/.test(c.rawValue));
            if (hit && !stopped) {
              stopped = true;
              haptic('success');
              onDetectedRef.current(hit.rawValue);
              return;
            }
          } catch {
            // transient decode errors are fine — try the next frame
          }
        }
        timer = setTimeout(tick, 160);
      };
      void tick();
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      trackRef.current = null;
    };
  }, []);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track || torch === null) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
      haptic('select');
    } catch {
      setTorch(null);
    }
  };

  const submitManual = (e: FormEvent) => {
    e.preventDefault();
    const code = manual.replace(/\D/g, '');
    if (code.length >= 8) onDetected(code);
  };

  const failed = state === 'denied' || state === 'unavailable';

  return (
    <div className="space-y-4 pb-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          aria-label="Camera preview"
          className={cn('absolute inset-0 size-full object-cover', failed && 'hidden')}
        />
        {!failed && (
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="relative h-[42%] w-[78%]">
              <span className="absolute top-0 left-0 size-7 rounded-tl-2xl border-t-4 border-l-4 border-white" />
              <span className="absolute top-0 right-0 size-7 rounded-tr-2xl border-t-4 border-r-4 border-white" />
              <span className="absolute bottom-0 left-0 size-7 rounded-bl-2xl border-b-4 border-l-4 border-white" />
              <span className="absolute right-0 bottom-0 size-7 rounded-br-2xl border-r-4 border-b-4 border-white" />
              {state === 'scanning' && (
                <span className="scan-line absolute inset-x-3 top-0 h-full">
                  <span className="block h-0.5 rounded-full bg-accent shadow-[0_0_12px_2px_var(--accent)]" />
                </span>
              )}
            </div>
          </div>
        )}
        {state === 'starting' && (
          <div className="absolute inset-0 grid place-items-center text-white/80">
            <Loader2 size={28} className="animate-spin" aria-label="Starting camera" />
          </div>
        )}
        {failed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center text-white">
            <CameraOff size={30} aria-hidden />
            <p className="font-semibold">{state === 'denied' ? 'Camera access is blocked' : 'Camera unavailable'}</p>
            <p className="text-sm text-white/70">
              {state === 'denied'
                ? 'Allow camera access for this site in your browser settings, or type the barcode below.'
                : 'Type the number printed under the barcode instead.'}
            </p>
          </div>
        )}
        {torch !== null && state === 'scanning' && (
          <button
            type="button"
            onClick={() => void toggleTorch()}
            aria-pressed={torch}
            aria-label={torch ? 'Turn off flashlight' : 'Turn on flashlight'}
            className="absolute right-3 bottom-3 grid size-11 place-items-center rounded-full bg-black/50 text-white backdrop-blur active:scale-90"
          >
            {torch ? <FlashlightOff size={20} aria-hidden /> : <Flashlight size={20} aria-hidden />}
          </button>
        )}
      </div>
      <p className="text-center text-sm text-fg-2" aria-live="polite">
        {state === 'scanning' ? 'Point the camera at a barcode' : state === 'starting' ? 'Starting camera…' : ''}
      </p>
      <form onSubmit={submitManual} className="flex gap-2">
        <input
          value={manual}
          onChange={(e) => setManual(e.target.value.replace(/[^\d]/g, '').slice(0, 14))}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Barcode number"
          aria-label="Barcode number"
          className="field min-w-0 flex-1 text-[16px] tabular"
        />
        <Button type="submit" variant="primary" icon={ScanBarcode} disabled={manual.length < 8}>
          Look up
        </Button>
      </form>
    </div>
  );
}
