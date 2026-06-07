import { WebContainer } from '@webcontainer/api';

// WebContainer can only boot ONCE per page — keep a singleton promise
let bootPromise = null;

export function bootWebContainer() {
  if (!bootPromise) {
    bootPromise = WebContainer.boot();
  }
  return bootPromise;
}

/**
 * Convert the flat DB file array into WebContainer's nested tree format.
 *
 * Flat:  [{ path: '/src/App.jsx', type: 'file', content: '...' }, ...]
 * Tree:  { src: { directory: { 'App.jsx': { file: { contents: '...' } } } } }
 */
export function filesToWebContainerTree(files) {
  const root = {};

  // Folders first so empty folders exist even with no children
  const sorted = [...files].sort((a, b) => (a.type === 'folder' ? -1 : 1) - (b.type === 'folder' ? -1 : 1));

  for (const f of sorted) {
    const segments = f.path.split('/').filter(Boolean);
    if (segments.length === 0) continue;

    let node = root;
    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      if (!node[seg]) node[seg] = { directory: {} };
      node = node[seg].directory;
    }

    const leaf = segments[segments.length - 1];
    if (f.type === 'folder') {
      if (!node[leaf]) node[leaf] = { directory: {} };
    } else {
      node[leaf] = { file: { contents: f.content || '' } };
    }
  }

  return root;
}

// Map file extension → Monaco language id
const EXT_LANGUAGE = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  css: 'css',
  scss: 'scss',
  html: 'html',
  json: 'json',
  md: 'markdown',
  svg: 'xml',
  yml: 'yaml',
  yaml: 'yaml',
};

export function languageFromPath(path) {
  const ext = path.split('.').pop()?.toLowerCase();
  return EXT_LANGUAGE[ext] || 'plaintext';
}
