import { create } from 'zustand';

export const useIDEStore = create((set, get) => ({
  project: null,
  files: [],
  openTabs: [],
  activeTab: null,
  webcontainerInstance: null,
  previewUrl: '',
  previewServers: {}, // port -> url (multiple dev servers can run at once)
  activePort: null,
  saveStatus: 'saved', // 'saved' | 'saving' | 'unsaved'
  terminalWriter: null, // function(data) — writes into the WC shell stdin
  running: false,
  terminalOpen: true,

  setProject: (project) =>
    set({
      project,
      files: project.files || [],
      openTabs: [],
      activeTab: null,
    }),

  openFile: (path) => {
    const { openTabs } = get();
    set({
      openTabs: openTabs.includes(path) ? openTabs : [...openTabs, path],
      activeTab: path,
    });
  },

  closeTab: (path) => {
    const { openTabs, activeTab } = get();
    const next = openTabs.filter((p) => p !== path);
    set({
      openTabs: next,
      activeTab:
        activeTab === path ? next[next.length - 1] || null : activeTab,
    });
  },

  updateFileContent: (path, content) =>
    set((state) => ({
      files: state.files.map((f) => (f.path === path ? { ...f, content } : f)),
    })),

  getFile: (path) => get().files.find((f) => f.path === path),

  addFile: (file) => set((state) => ({ files: [...state.files, file] })),

  removeFile: (path) => {
    const { files, openTabs, activeTab } = get();
    const nextTabs = openTabs.filter((p) => p !== path && !p.startsWith(path + '/'));
    set({
      files: files.filter((f) => f.path !== path && !f.path.startsWith(path + '/')),
      openTabs: nextTabs,
      activeTab:
        activeTab && (activeTab === path || activeTab.startsWith(path + '/'))
          ? nextTabs[nextTabs.length - 1] || null
          : activeTab,
    });
  },

  setWebcontainer: (wc) => set({ webcontainerInstance: wc }),
  setPreviewUrl: (url) => set({ previewUrl: url }),

  addPreviewServer: (port, url) =>
    set((s) => ({
      previewServers: { ...s.previewServers, [port]: url },
      activePort: port,
      previewUrl: url,
    })),

  removePreviewServer: (port) =>
    set((s) => {
      const previewServers = { ...s.previewServers };
      delete previewServers[port];
      const ports = Object.keys(previewServers);
      const activePort =
        String(s.activePort) === String(port)
          ? ports[ports.length - 1] ?? null
          : s.activePort;
      return {
        previewServers,
        activePort,
        previewUrl: activePort ? previewServers[activePort] : '',
        // Last server gone (crashed or Ctrl+C) → back to runnable
        running: ports.length > 0 ? s.running : false,
      };
    }),

  setActivePort: (port) =>
    set((s) => ({
      activePort: port,
      previewUrl: s.previewServers[port] || '',
    })),
  setSaveStatus: (status) => set({ saveStatus: status }),
  setTerminalWriter: (fn) => set({ terminalWriter: fn }),
  setRunning: (running) => set({ running }),
  toggleTerminal: () => set((s) => ({ terminalOpen: !s.terminalOpen })),

  reset: () =>
    set({
      project: null,
      files: [],
      openTabs: [],
      activeTab: null,
      previewUrl: '',
      previewServers: {},
      activePort: null,
      saveStatus: 'saved',
      running: false,
    }),
}));
