/** A barista's marker tick. It draws itself (stroke-dashoffset) when its box is
 *  marked; the stylesheet keeps the stroke drawn and still under reduced motion. */
export function MarkerTick({ className = "" }: { className?: string }) {
  return (
    <svg className={`sf-tick ${className}`} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M5 17.5c2.6 1.7 5 4.3 7 7.4C15.6 16.4 20.4 9.9 27.5 5" pathLength={1} />
    </svg>
  );
}
