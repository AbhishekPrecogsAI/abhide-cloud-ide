import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Minus, X } from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useIDEStore } from '../../store/ideStore';

const XTERM_THEME = {
  background: '#0a0a0c',
  foreground: '#e7e7ea',
  cursor: '#6ee7b7',
  cursorAccent: '#0a0a0c',
  selectionBackground: '#6ee7b733',
  black: '#17171b',
  brightBlack: '#5c5c66',
  green: '#6ee7b7',
  brightGreen: '#6ee7b7',
};

/** One xterm + jsh process. Stays mounted (hidden) when inactive so the
 *  process keeps running and scrollback is preserved. */
function TerminalInstance({ id, wc, active, onWriter }) {
  const hostRef = useRef(null);
  const fitRef = useRef(null);

  useEffect(() => {
    if (!wc || !hostRef.current) return;

    let disposed = false;
    let shellProcess = null;
    let resizeObserver = null;

    const term = new Terminal({
      convertEol: true,
      cursorBlink: true,
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 12.5,
      lineHeight: 1.4,
      theme: XTERM_THEME,
    });
    const fit = new FitAddon();
    fitRef.current = fit;
    term.loadAddon(fit);
    term.open(hostRef.current);
    fit.fit();

    async function startShell() {
      // jsh is WebContainer's built-in shell — always use it, never bash
      shellProcess = await wc.spawn('jsh', {
        terminal: { cols: term.cols, rows: term.rows },
      });
      if (disposed) {
        shellProcess.kill();
        return;
      }

      shellProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            term.write(data);
          },
        })
      );

      const input = shellProcess.input.getWriter();
      term.onData((data) => input.write(data));

      // Expose this shell's stdin to the parent (Run button etc.)
      onWriter(id, (data) => input.write(data));

      // Keep terminal + pty sized to the panel
      resizeObserver = new ResizeObserver(() => {
        fit.fit();
        shellProcess.resize({ cols: term.cols, rows: term.rows });
      });
      resizeObserver.observe(hostRef.current);
    }

    startShell();

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      shellProcess?.kill();
      term.dispose();
      onWriter(id, null);
    };
  }, [wc]); // eslint-disable-line react-hooks/exhaustive-deps

  // Refit when this tab becomes visible
  useEffect(() => {
    if (active) fitRef.current?.fit();
  }, [active]);

  return (
    <div
      ref={hostRef}
      className={`terminal-host absolute inset-0 ${active ? 'visible' : 'invisible'}`}
    />
  );
}

export default function TerminalPanel() {
  const webcontainerInstance = useIDEStore((s) => s.webcontainerInstance);
  const setTerminalWriter = useIDEStore((s) => s.setTerminalWriter);

  const [terminals, setTerminals] = useState([{ id: 1 }]);
  const [activeId, setActiveId] = useState(1);
  const nextIdRef = useRef(2);
  const writersRef = useRef({});
  const activeIdRef = useRef(1);
  activeIdRef.current = activeId;

  // The store's terminalWriter always points at the ACTIVE tab's shell
  const onWriter = useCallback(
    (id, fn) => {
      if (fn) writersRef.current[id] = fn;
      else delete writersRef.current[id];
      if (id === activeIdRef.current) setTerminalWriter(fn);
    },
    [setTerminalWriter]
  );

  useEffect(() => {
    setTerminalWriter(writersRef.current[activeId] || null);
  }, [activeId, setTerminalWriter]);

  function addTerminal() {
    const id = nextIdRef.current++;
    setTerminals((t) => [...t, { id }]);
    setActiveId(id);
  }

  function closeTerminal(e, id) {
    e.stopPropagation();
    setTerminals((t) => {
      const next = t.filter((term) => term.id !== id);
      if (id === activeIdRef.current && next.length) {
        setActiveId(next[next.length - 1].id);
      }
      return next;
    });
  }

  return (
    <div className="h-full flex flex-col bg-surface-0">
      {/* Tab bar */}
      <div className="h-7 shrink-0 flex items-center px-2 gap-0.5 bg-surface-1 border-b border-subtle overflow-x-auto">
        <span className="w-1.5 h-1.5 rounded-full bg-accent mx-1.5 shrink-0" />
        {terminals.map((t, i) => (
          <div
            key={t.id}
            onClick={() => setActiveId(t.id)}
            className={`group flex items-center gap-1.5 px-2.5 h-full font-mono text-[11px] cursor-pointer whitespace-nowrap border-b-2 transition-colors
              ${
                t.id === activeId
                  ? 'text-accent border-accent'
                  : 'text-ink-faint border-transparent hover:text-ink-dim'
              }`}
          >
            jsh:{i + 1}
            {terminals.length > 1 && (
              <button
                onClick={(e) => closeTerminal(e, t.id)}
                title="Close terminal"
                className="text-ink-faint hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={11} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addTerminal}
          title="New terminal"
          className="px-2 text-ink-faint hover:text-accent transition-colors shrink-0"
        >
          <Plus size={13} />
        </button>
        <div className="flex-1" />
        <button
          onClick={() => useIDEStore.getState().toggleTerminal()}
          title="Hide terminal (Ctrl+`)"
          className="px-2 text-ink-faint hover:text-ink transition-colors shrink-0"
        >
          <Minus size={13} />
        </button>
      </div>

      {/* Stacked terminal instances — all mounted, only the active one visible */}
      <div className="relative flex-1 min-h-0">
        {terminals.map((t) => (
          <TerminalInstance
            key={t.id}
            id={t.id}
            wc={webcontainerInstance}
            active={t.id === activeId}
            onWriter={onWriter}
          />
        ))}
      </div>
    </div>
  );
}
