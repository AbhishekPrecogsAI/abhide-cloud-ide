import { useEffect } from 'react';
import { useSettingsStore } from '../../store/settingsStore';

const THEMES = [
  { id: 'webide-dark', label: 'WebIDE Dark', bg: '#0a0a0c', fg: '#6ee7b7' },
  { id: 'vs-dark', label: 'VS Dark', bg: '#1e1e1e', fg: '#569cd6' },
  { id: 'vs', label: 'Light', bg: '#ffffff', fg: '#795e26' },
  { id: 'hc-black', label: 'High Contrast', bg: '#000000', fg: '#ffff00' },
];

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
        checked ? 'bg-accent' : 'bg-surface-4'
      }`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-surface-0 transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div>
        <p className="text-sm">{label}</p>
        {hint && <p className="text-[11px] text-ink-faint">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsModal({ onClose }) {
  const { editorTheme, fontSize, minimap, wordWrap, fileIcons, update } =
    useSettingsStore();

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-surface-1 border border-subtle rounded-2xl p-6 shadow-2xl shadow-black/60 animate-fade-up"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-mono text-sm font-semibold uppercase tracking-widest text-ink-dim">
            settings
          </h2>
          <button
            onClick={onClose}
            className="text-ink-faint hover:text-ink text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Theme */}
        <p className="font-mono text-[11px] uppercase tracking-widest text-ink-faint mb-2">
          editor theme
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => update({ editorTheme: t.id })}
              className={`flex items-center gap-2.5 rounded-lg border p-2.5 transition-all text-left ${
                editorTheme === t.id
                  ? 'border-accent/60 bg-accent/5'
                  : 'border-subtle bg-surface-2 hover:bg-surface-3'
              }`}
            >
              <span
                className="w-6 h-6 rounded-md border border-white/10 grid place-items-center font-mono text-[10px] shrink-0"
                style={{ background: t.bg, color: t.fg }}
              >
                Aa
              </span>
              <span className="text-xs">{t.label}</span>
            </button>
          ))}
        </div>

        <div className="divide-y divide-white/5">
          <Row label="Font size" hint="Editor text size">
            <div className="flex items-center gap-1 bg-surface-2 border border-subtle rounded-lg px-1">
              <button
                onClick={() => update({ fontSize: Math.max(11, fontSize - 1) })}
                className="px-2 py-1 text-ink-dim hover:text-accent font-mono"
              >
                −
              </button>
              <span className="font-mono text-xs w-10 text-center">{fontSize}px</span>
              <button
                onClick={() => update({ fontSize: Math.min(20, fontSize + 1) })}
                className="px-2 py-1 text-ink-dim hover:text-accent font-mono"
              >
                +
              </button>
            </div>
          </Row>

          <Row label="Minimap" hint="Code overview on the right">
            <Toggle checked={minimap} onChange={(v) => update({ minimap: v })} />
          </Row>

          <Row label="Word wrap" hint="Wrap long lines">
            <Toggle checked={wordWrap} onChange={(v) => update({ wordWrap: v })} />
          </Row>

          <Row label="File icons" hint="Type icons in the explorer">
            <Toggle checked={fileIcons} onChange={(v) => update({ fileIcons: v })} />
          </Row>
        </div>
      </div>
    </div>
  );
}
