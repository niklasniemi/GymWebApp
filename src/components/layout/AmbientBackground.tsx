/**
 * Static color field that Liquid Glass surfaces refract. Pure gradients on a
 * fixed layer — no filters, no animation — so it costs one paint, ever.
 */
export function AmbientBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 opacity-0 transition-opacity duration-500 glass:opacity-100"
      style={{
        background: [
          'radial-gradient(60% 45% at 12% 8%, var(--ambient-1), transparent 70%)',
          'radial-gradient(50% 40% at 95% 30%, var(--ambient-2), transparent 70%)',
          'radial-gradient(55% 45% at 30% 95%, var(--ambient-3), transparent 70%)',
          'var(--ambient-base)',
        ].join(','),
      }}
    />
  );
}
