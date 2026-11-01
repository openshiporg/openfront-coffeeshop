/** A quiet line drawing of an espresso machine pulling a shot, set on a soft round wash. Decorative only. */
export function BrewIllustration({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 240 240" fill="none" aria-hidden="true" focusable="false">
      <path d="M120 18c42 0 86 22 98 64 12 44-6 98-46 122-36 22-90 20-122-8C18 168 8 118 22 80 36 40 76 18 120 18Z" fill="var(--sf-wash)" />
      <g stroke="var(--sf-ink-soft)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M58 72h86v22H58z" />
        <path d="M100 64v8M92 60h16" />
        <path d="M144 80h10c6 0 8 4 8 9v9" />
        <path d="M84 94v12h34V94" />
        <path d="M90 106v8h22v-8" />
        <path d="M80 126h40v28c0 8-6 14-14 14h-12c-8 0-14-6-14-14v-28Z" />
        <path d="M120 134h6c5 0 8 4 8 8s-3 8-8 8h-6" />
        <path d="M58 182h104M66 172h86" />
        <path d="M58 94v88" />
      </g>
      <path d="M84 142h32v12c0 6-4 9-10 9h-12c-6 0-10-3-10-9v-12Z" fill="var(--sf-ink-soft)" opacity=".28" />
      <path d="M101 116v8" stroke="var(--sf-ink-soft)" strokeWidth="2" strokeLinecap="round" strokeDasharray="2 4" />
      <g transform="rotate(-28 176 134)">
        <ellipse cx="176" cy="134" rx="15" ry="20" fill="oklch(52% 0.06 55)" />
        <path d="M176 115c-6 8 6 30 0 38" stroke="oklch(36% 0.05 55)" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <g stroke="var(--sf-accent)" strokeWidth="2.4" strokeLinecap="round">
        <path d="M168 104l-4-8M184 102l2-9M200 132h9M196 152l7 6M178 162l-1 9" />
      </g>
    </svg>
  );
}
