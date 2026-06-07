import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Settings } from 'lucide-react';
import api from '../lib/api';
import { bootWebContainer, filesToWebContainerTree } from '../lib/webcontainer';
import { startFileSync } from '../lib/wcSync';
import { initCollab, destroyCollab } from '../lib/collab';
import { leaveVoice } from '../lib/voice';
import { useIDEStore } from '../store/ideStore';
import { useAuthStore } from '../store/authStore';
import TopBar from '../components/Layout/TopBar.jsx';
import SettingsModal from '../components/Layout/SettingsModal.jsx';
import FileTree from '../components/FileTree/FileTree.jsx';
import EditorPanel from '../components/Editor/EditorPanel.jsx';
import Preview from '../components/Preview/Preview.jsx';
import TerminalPanel from '../components/Terminal/TerminalPanel.jsx';

const TERMINAL_MIN = 80;
const PREVIEW_MIN = 240;

export default function IDE() {
  const { id } = useParams();
  const {
    setProject,
    setWebcontainer,
    addPreviewServer,
    removePreviewServer,
    openFile,
    reset,
  } = useIDEStore();
  const terminalWriter = useIDEStore((s) => s.terminalWriter);
  const terminalOpen = useIDEStore((s) => s.terminalOpen);
  const [status, setStatus] = useState('loading'); // loading | booting | ready | error
  const [errorMsg, setErrorMsg] = useState('');
  const autoRanRef = useRef(false);

  // Panel sizing
  const [terminalHeight, setTerminalHeight] = useState(208);
  const [previewWidth, setPreviewWidth] = useState(384);
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const [dragging, setDragging] = useState(null); // 'terminal' | 'preview' | 'sidebar' | null
  const [showSettings, setShowSettings] = useState(false);
  const layoutRef = useRef(null);

  const startDrag = useCallback((which) => (e) => {
    e.preventDefault();
    setDragging(which);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    function onMove(e) {
      const rect = layoutRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (dragging === 'terminal') {
        const max = rect.height - 120; // keep some editor visible
        setTerminalHeight(Math.min(max, Math.max(TERMINAL_MIN, rect.bottom - e.clientY)));
      } else if (dragging === 'sidebar') {
        setSidebarWidth(Math.min(420, Math.max(160, e.clientX - rect.left)));
      } else {
        const max = rect.width - 320; // keep some editor visible
        setPreviewWidth(Math.min(max, Math.max(PREVIEW_MIN, rect.right - e.clientX)));
      }
    }
    function onUp() {
      setDragging(null);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.body.style.cursor = dragging === 'terminal' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging]);

  // Ctrl+` toggles the terminal panel
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault();
        useIDEStore.getState().toggleTerminal();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Auto-run on load: once the shell is ready, kick off `npm install && npm run dev`
  // if the project is runnable (has a package.json with a dev script)
  useEffect(() => {
    if (status !== 'ready' || !terminalWriter || autoRanRef.current) return;

    const { files, running, setRunning } = useIDEStore.getState();
    if (running) return;

    const pkg = files.find((f) => f.path === '/package.json');
    if (!pkg) return;
    try {
      if (!JSON.parse(pkg.content)?.scripts?.dev) return;
    } catch {
      return;
    }

    autoRanRef.current = true;
    setRunning(true);
    // Small delay so the jsh prompt has rendered before the command echoes
    const t = setTimeout(() => terminalWriter('npm install && npm run dev\r'), 400);
    return () => clearTimeout(t);
  }, [status, terminalWriter]);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe = null;

    async function init() {
      try {
        // 1. Fetch project
        const { data } = await api.get(`/projects/${id}`);
        if (cancelled) return;
        setProject(data.project);

        // Realtime collaboration: shared Yjs doc per project
        const { user, token } = useAuthStore.getState();
        initCollab(data.project, user, token, {
          getFiles: () => useIDEStore.getState().files,
          // Remote edit → mirror into store + WC fs (their preview hot-reloads)
          onRemoteChange: (path, content) => {
            const st = useIDEStore.getState();
            const f = st.getFile(path);
            if (f && f.content !== content) {
              st.updateFileContent(path, content);
              st.webcontainerInstance?.fs.writeFile(path, content).catch(() => {});
            }
          },
        });

        // Open last-opened (or first) file
        const firstFile =
          data.project.files.find((f) => f.path === data.project.lastOpenedFile) ||
          data.project.files.find((f) => f.type === 'file');
        if (firstFile) openFile(firstFile.path);

        // 2. Boot WebContainer (singleton)
        setStatus('booting');
        const wc = await bootWebContainer();
        if (cancelled) return;

        // 3. Mount project files into the WC virtual filesystem
        await wc.mount(filesToWebContainerTree(data.project.files));
        if (cancelled) return;

        const unsubReady = wc.on('server-ready', (port, url) => {
          addPreviewServer(port, url);
        });
        const unsubPort = wc.on('port', (port, type) => {
          if (type === 'close') removePreviewServer(port);
        });
        // Reverse sync: terminal-made file changes (npm install touching
        // package.json, generated files, rm) flow back to editor + DB
        const stopSync = startFileSync(wc);
        unsubscribe = () => {
          unsubReady();
          unsubPort();
          stopSync();
        };

        setWebcontainer(wc);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setErrorMsg(
          err.response?.data?.message ||
            err.message ||
            'Failed to initialize the IDE'
        );
        setStatus('error');
      }
    }

    init();
    return () => {
      cancelled = true;
      if (unsubscribe) unsubscribe();
      leaveVoice();
      destroyCollab();
      reset();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading' || status === 'booting') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 grid-bg">
        <p className="font-mono text-sm text-ink-dim">
          {status === 'loading' ? '$ fetching project…' : '$ booting webcontainer…'}
          <span className="text-accent animate-blink">▋</span>
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 grid-bg px-6">
        <p className="font-mono text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3 max-w-lg text-center">
          {errorMsg}
        </p>
        <p className="text-xs text-ink-faint max-w-md text-center">
          WebContainer requires a Chromium browser and COOP/COEP headers. Check the
          console for SharedArrayBuffer errors.
        </p>
        <Link to="/" className="btn-ghost border border-subtle text-sm">
          ← Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-surface-0 overflow-hidden">
      <TopBar />
      <div ref={layoutRef} className="flex-1 flex min-h-0">
        {/* File explorer */}
        <aside
          style={{ width: sidebarWidth }}
          className="shrink-0 bg-surface-1 flex flex-col min-h-0"
        >
          <div className="flex-1 overflow-y-auto">
            <FileTree />
          </div>
          {/* Sidebar footer — settings */}
          <div className="shrink-0 border-t border-subtle px-2 py-1.5">
            <button
              onClick={() => setShowSettings(true)}
              title="Settings"
              className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 font-mono text-[12px] text-ink-dim hover:text-ink hover:bg-surface-2 transition-colors group"
            >
              <Settings
                size={14}
                className="group-hover:rotate-45 transition-transform duration-300"
              />
              settings
            </button>
          </div>
        </aside>

        {/* Sidebar resize handle */}
        <div
          onMouseDown={startDrag('sidebar')}
          className={`w-1 shrink-0 cursor-col-resize transition-colors hover:bg-accent/50 ${
            dragging === 'sidebar' ? 'bg-accent/70' : 'bg-surface-3'
          }`}
          title="Drag to resize explorer"
        />

        {/* Editor + terminal column */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0">
            <EditorPanel />
          </div>

          {/* Terminal resize handle */}
          <div
            onMouseDown={startDrag('terminal')}
            className={`h-1 shrink-0 cursor-row-resize transition-colors hover:bg-accent/50 ${
              dragging === 'terminal' ? 'bg-accent/70' : 'bg-surface-3'
            } ${terminalOpen ? '' : 'hidden'}`}
            title="Drag to resize terminal"
          />

          {/* Hidden via CSS (not unmounted) so shells keep running */}
          <div
            style={{ height: terminalHeight }}
            className={terminalOpen ? 'shrink-0' : 'hidden'}
          >
            <TerminalPanel />
          </div>
        </div>

        {/* Preview resize handle */}
        <div
          onMouseDown={startDrag('preview')}
          className={`w-1 shrink-0 cursor-col-resize transition-colors hover:bg-accent/50 ${
            dragging === 'preview' ? 'bg-accent/70' : 'bg-surface-3'
          }`}
          title="Drag to resize preview"
        />

        {/* Live preview — pointer events off while dragging so the iframe
            doesn't swallow mousemove */}
        <aside
          style={{ width: previewWidth }}
          className={`shrink-0 ${dragging ? 'pointer-events-none' : ''}`}
        >
          <Preview />
        </aside>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
