import { useEffect, useRef, useState } from 'react';
import { RotateCw, Maximize2, Minimize2, ExternalLink, Play } from 'lucide-react';
import { useIDEStore } from '../../store/ideStore';

function joinUrl(base, path) {
  if (!base) return '';
  return base.replace(/\/+$/, '') + (path.startsWith('/') ? path : `/${path}`);
}

export default function Preview() {
  const { previewUrl, previewServers, activePort, setActivePort, running } =
    useIDEStore();
  const iframeRef = useRef(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [maximized, setMaximized] = useState(false);

  // Editable path — type /api/hello and hit Enter to navigate the iframe
  const [path, setPath] = useState('/');
  const [committedPath, setCommittedPath] = useState('/');

  const ports = Object.keys(previewServers);
  const src = joinUrl(previewUrl, committedPath);

  // New server selected → back to root
  useEffect(() => {
    setPath('/');
    setCommittedPath('/');
  }, [previewUrl]);

  // Esc exits fullscreen preview
  useEffect(() => {
    if (!maximized) return;
    const onKey = (e) => e.key === 'Escape' && setMaximized(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [maximized]);

  function navigate() {
    const clean = path.trim() || '/';
    setPath(clean);
    setCommittedPath(clean);
    setReloadKey((k) => k + 1);
  }

  return (
    // Keep the same DOM node when maximizing so the iframe never reloads
    <div
      className={
        maximized
          ? 'fixed inset-0 z-50 flex flex-col bg-surface-1'
          : 'h-full flex flex-col bg-surface-1'
      }
    >
      {/* Address bar */}
      <div className="h-9 shrink-0 flex items-center gap-1.5 px-2.5 border-b border-subtle">
        {/* Port switcher — shows when servers are running */}
        {ports.length > 0 && (
          <select
            value={activePort ?? ''}
            onChange={(e) => setActivePort(e.target.value)}
            title="Switch dev server"
            className="bg-surface-2 border border-subtle rounded-md font-mono text-[11px] text-accent px-1.5 py-1 outline-none cursor-pointer hover:bg-surface-3"
          >
            {ports.map((p) => (
              <option key={p} value={p}>
                :{p}
              </option>
            ))}
          </select>
        )}

        {/* Path input */}
        <input
          value={previewUrl ? path : ''}
          onChange={(e) => setPath(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && navigate()}
          disabled={!previewUrl}
          placeholder={previewUrl ? '/' : 'waiting for server…'}
          spellCheck={false}
          title="Type a path (e.g. /api/hello) and press Enter"
          className="flex-1 min-w-0 bg-surface-2 border border-subtle rounded-md px-2.5 py-1 font-mono text-[11px] text-ink-dim outline-none focus:border-accent/50 focus:text-ink disabled:opacity-60"
        />

        <button
          onClick={() => setReloadKey((k) => k + 1)}
          disabled={!previewUrl}
          title="Reload preview"
          className="text-ink-faint hover:text-accent disabled:opacity-30 p-0.5 transition-colors"
        >
          <RotateCw size={13} />
        </button>
        <button
          onClick={() => setMaximized((m) => !m)}
          disabled={!previewUrl}
          title={maximized ? 'Exit fullscreen (Esc)' : 'Fullscreen preview'}
          className="text-ink-faint hover:text-accent disabled:opacity-30 p-0.5 transition-colors"
        >
          {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
        <button
          onClick={() => window.open(src, '_blank')}
          disabled={!previewUrl}
          title="Open in new tab (may not work in all browsers — preview lives in this tab)"
          className="text-ink-faint hover:text-accent disabled:opacity-30 p-0.5 transition-colors"
        >
          <ExternalLink size={13} />
        </button>
        {maximized && (
          <button
            onClick={() => setMaximized(false)}
            className="font-mono text-[11px] text-ink-dim hover:text-ink bg-surface-2 border border-subtle rounded-md px-2 py-1 transition-colors"
          >
            esc to exit
          </button>
        )}
      </div>

      {/* Frame */}
      <div className="flex-1 min-h-0 bg-white">
        {previewUrl ? (
          <iframe
            key={`${src}-${reloadKey}`}
            ref={iframeRef}
            src={src}
            title="Live preview"
            className="w-full h-full border-0"
            allow="cross-origin-isolated"
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 bg-surface-0 select-none">
            <div className="w-10 h-10 rounded-xl border border-subtle bg-surface-2 grid place-items-center text-accent">
              <Play size={16} fill="currentColor" />
            </div>
            <p className="font-mono text-xs text-ink-faint text-center px-6 leading-relaxed">
              {running
                ? 'starting dev server…'
                : 'hit Run to install deps\nand start the dev server'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
