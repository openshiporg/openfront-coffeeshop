/** The check inside a chosen option or an earned reward. Drawn once (stroke-dashoffset)
 *  when it appears; the stylesheet keeps it still under reduced motion. */
export function MarkerTick({ className = "" }: { className?: string }) {
  return (
    <svg className={`sf-tick ${className}`} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M8 16.5l5.5 5.5L24.5 10.5" pathLength={1} />
    </svg>
  );
}
