import { Logo } from '../Logo.jsx';

const FEATURES = [
  ['$', 'real node.js terminal in the browser'],
  ['▶', 'instant live preview, hot reload'],
  ['⇆', 'live collab — shared cursors with friends'],
  ['☎', 'voice call & chat, built right in'],
  ['⑂', 'import any public github repo'],
  ['⚡', 'zero setup — no VM, no server'],
];

export default function AuthLayout({ children }) {
  return (
    <div className="relative min-h-full overflow-hidden bg-surface-0">
      {/* Ambient atmosphere */}
      <div className="orb orb-mint" />
      <div className="orb orb-violet" />
      <div className="orb orb-sky" />
      <div className="absolute inset-0 grid-bg opacity-50" />

      <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
        {/* Left — brand panel (desktop only) */}
        <div className="hidden lg:flex flex-col justify-between p-16 xl:p-24">
          <span className="animate-fade-up">
            <Logo />
          </span>

          <div className="space-y-10">
            <h1
              className="text-5xl xl:text-6xl font-bold leading-[1.08] tracking-tight animate-fade-up"
              style={{ animationDelay: '100ms' }}
            >
              Code in
              <br />
              your browser.
              <span className="text-accent">*</span>
            </h1>
            <p
              className="text-ink-dim text-lg max-w-sm leading-relaxed animate-fade-up"
              style={{ animationDelay: '200ms' }}
            >
              A full development environment — editor, terminal, preview — running
              entirely in the tab you're looking at. Invite a friend and build
              together, live.
            </p>

            <ul className="space-y-3.5">
              {FEATURES.map(([glyph, text], i) => (
                <li
                  key={text}
                  className="flex items-center gap-3.5 font-mono text-[13px] text-ink-dim animate-fade-up"
                  style={{ animationDelay: `${320 + i * 90}ms` }}
                >
                  <span className="w-7 h-7 rounded-lg glass-card grid place-items-center text-accent text-xs shrink-0">
                    {glyph}
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>

          <p
            className="font-mono text-[11px] text-ink-faint animate-fade-up"
            style={{ animationDelay: '600ms' }}
          >
            <span className="text-accent">*</span> powered by webcontainers · crafted
            by abhishek
          </p>
        </div>

        {/* Right — form */}
        <div className="flex items-center justify-center p-6 sm:p-12 lg:p-16">
          <div className="w-full max-w-[400px]">
            {/* Wordmark on mobile */}
            <div className="lg:hidden mb-10 flex justify-center animate-fade-up">
              <Logo size="lg" />
            </div>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
