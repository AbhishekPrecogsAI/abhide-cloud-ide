/** abhide — abhi + IDE. Mark: code brackets + slash in a rounded tile. */

export function LogoMark({ size = 26, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="abhide-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6ee7b7" />
          <stop offset="100%" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#17171b" />
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="7.5"
        fill="none"
        stroke="url(#abhide-g)"
        strokeOpacity="0.35"
      />
      <path
        d="M10 11l-4.5 5L10 21M22 11l4.5 5L22 21M18.2 8.5l-4.4 15"
        stroke="url(#abhide-g)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({ size = 'md', mark = true, className = '' }) {
  const text =
    size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base';
  const markSize = size === 'sm' ? 20 : size === 'lg' ? 30 : 24;

  return (
    <span className={`inline-flex items-center gap-2 font-mono font-semibold ${text} ${className}`}>
      {mark && <LogoMark size={markSize} />}
      <span>
        abh<span className="text-accent">ide</span>
        <span className="text-accent animate-blink">_</span>
      </span>
    </span>
  );
}
