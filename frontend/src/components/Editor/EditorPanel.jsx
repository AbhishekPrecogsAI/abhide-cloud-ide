import { useRef, useEffect, useCallback, useState } from 'react';
import Editor from '@monaco-editor/react';
import { MonacoBinding } from 'y-monaco';
import api from '../../lib/api';
import { useIDEStore } from '../../store/ideStore';
import { useSettingsStore } from '../../store/settingsStore';
import { languageFromPath } from '../../lib/webcontainer';
import { getYText, getAwareness, useCollabReady } from '../../lib/collab';

const AUTOSAVE_DELAY = 1500;

// Monaco theme matching the surface palette
function defineTheme(monaco) {
  monaco.editor.defineTheme('webide-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '5c5c66', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c4b5fd' },
      { token: 'string', foreground: '6ee7b7' },
      { token: 'number', foreground: 'fbbf24' },
      { token: 'type', foreground: '7dd3fc' },
    ],
    colors: {
      'editor.background': '#0a0a0c',
      'editor.foreground': '#e7e7ea',
      'editor.lineHighlightBackground': '#111114',
      'editorLineNumber.foreground': '#3a3a44',
      'editorLineNumber.activeForeground': '#9a9aa3',
      'editorCursor.foreground': '#6ee7b7',
      'editor.selectionBackground': '#6ee7b733',
      'editorIndentGuide.background1': '#1e1e24',
      'editorWidget.background': '#17171b',
      'editorWidget.border': '#26262e',
      'editorSuggestWidget.selectedBackground': '#26262e',
    },
  });
}

export default function EditorPanel() {
  const {
    project,
    openTabs,
    activeTab,
    getFile,
    openFile,
    closeTab,
    updateFileContent,
    setSaveStatus,
    webcontainerInstance,
  } = useIDEStore();
  const { editorTheme, fontSize, minimap, wordWrap } = useSettingsStore();
  const collabReady = useCollabReady();

  const debounceRef = useRef(null);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const bindingRef = useRef(null);
  const [editorMounted, setEditorMounted] = useState(false);

  const persistFile = useCallback(
    async (path, content) => {
      setSaveStatus('saving');
      try {
        await api.put(`/files/${project._id}/save`, { path, content });
        // Mirror to WC fs so the dev server hot-reloads
        if (webcontainerInstance) {
          await webcontainerInstance.fs.writeFile(path, content).catch(() => {});
        }
        setSaveStatus('saved');
      } catch {
        setSaveStatus('unsaved');
      }
    },
    [project?._id, webcontainerInstance, setSaveStatus]
  );

  function handleChange(value) {
    if (activeTab == null || value == null) return;
    updateFileContent(activeTab, value);
    setSaveStatus('unsaved');

    clearTimeout(debounceRef.current);
    const path = activeTab;
    debounceRef.current = setTimeout(() => persistFile(path, value), AUTOSAVE_DELAY);
  }

  // Flush pending timer on unmount
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  // Bind the active file's Monaco model to its shared Y.Text (live co-editing)
  useEffect(() => {
    bindingRef.current?.destroy();
    bindingRef.current = null;

    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!collabReady || !editorMounted || !editor || !monaco || !activeTab) return;

    const model = monaco.editor
      .getModels()
      .find((m) => m.uri.path === activeTab);
    if (!model) return;

    const ytext = getYText(activeTab, getFile(activeTab)?.content || '');
    const awareness = getAwareness();
    if (!ytext || !awareness) return;

    bindingRef.current = new MonacoBinding(ytext, model, new Set([editor]), awareness);

    // The shared doc is the source of truth — align the store with it so the
    // controlled `value` prop doesn't fight the binding
    const remote = ytext.toString();
    if (remote !== (getFile(activeTab)?.content ?? '')) {
      updateFileContent(activeTab, remote);
    }

    return () => {
      bindingRef.current?.destroy();
      bindingRef.current = null;
    };
  }, [collabReady, editorMounted, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Remember last opened file on the project
  useEffect(() => {
    if (activeTab && project?._id) {
      api.put(`/projects/${project._id}`, { lastOpenedFile: activeTab }).catch(() => {});
    }
  }, [activeTab, project?._id]);

  const activeFile = activeTab ? getFile(activeTab) : null;

  return (
    <div className="h-full flex flex-col bg-surface-0">
      {/* Tabs */}
      <div className="h-9 shrink-0 flex items-end bg-surface-1 border-b border-subtle overflow-x-auto">
        {openTabs.map((path) => {
          const isActive = path === activeTab;
          const name = path.split('/').pop();
          return (
            <div
              key={path}
              onClick={() => openFile(path)}
              className={`group flex items-center gap-2 px-3.5 h-8 font-mono text-[12px] cursor-pointer border-t-2 whitespace-nowrap transition-colors
                ${
                  isActive
                    ? 'bg-surface-0 text-ink border-accent'
                    : 'bg-transparent text-ink-dim border-transparent hover:text-ink'
                }`}
            >
              {name}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(path);
                }}
                className={`text-[10px] rounded px-0.5 ${
                  isActive
                    ? 'text-ink-faint hover:text-ink'
                    : 'opacity-0 group-hover:opacity-100 text-ink-faint hover:text-ink'
                }`}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {/* Editor / empty state */}
      <div className="flex-1 min-h-0">
        {activeFile ? (
          <Editor
            height="100%"
            path={activeFile.path}
            language={languageFromPath(activeFile.path)}
            value={activeFile.content}
            onChange={handleChange}
            onMount={(editor, monaco) => {
              editorRef.current = editor;
              monacoRef.current = monaco;
              setEditorMounted(true);
            }}
            beforeMount={defineTheme}
            theme={editorTheme}
            options={{
              fontFamily: '"JetBrains Mono", monospace',
              fontSize,
              lineHeight: 1.7,
              minimap: { enabled: minimap },
              wordWrap: wordWrap ? 'on' : 'off',
              scrollBeyondLastLine: false,
              padding: { top: 14 },
              smoothScrolling: true,
              cursorBlinking: 'phase',
              renderLineHighlight: 'all',
              fontLigatures: true,
              tabSize: 2,
              automaticLayout: true,
            }}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-2 select-none">
            <p className="font-mono text-3xl text-surface-4">{'</>'}</p>
            <p className="font-mono text-xs text-ink-faint">select a file to start editing</p>
          </div>
        )}
      </div>
    </div>
  );
}
