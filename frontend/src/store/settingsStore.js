import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useSettingsStore = create(
  persist(
    (set) => ({
      editorTheme: 'webide-dark', // 'webide-dark' | 'vs-dark' | 'vs' | 'hc-black'
      fontSize: 13,
      minimap: false,
      wordWrap: false,
      fileIcons: true,

      update: (patch) => set(patch),
    }),
    { name: 'webide-settings' }
  )
);
