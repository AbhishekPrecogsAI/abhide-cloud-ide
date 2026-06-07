import api from './api';
import { useIDEStore } from '../store/ideStore';
import { languageFromPath } from './webcontainer';

// Reverse sync: WebContainer fs → store + MongoDB.
// Covers things the terminal does to files: npm install updating package.json,
// scaffolders (npm create vite) generating whole trees, `rm` deleting files, etc.

const IGNORED_SEGMENTS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  '.vite', '.cache', '.npm', '.pnpm-store', '.yarn',
]);
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|zip|gz|mp[34]|wasm)$/i;

function isIgnored(path) {
  if (BINARY_EXT.test(path)) return true;
  // Match ignored dirs at ANY depth (/myapp/node_modules too, not just /node_modules)
  return path.split('/').some((seg) => IGNORED_SEGMENTS.has(seg));
}

export function startFileSync(wc) {
  const timers = new Map();

  const onEvent = (event, filename) => {
    if (!filename) return;
    const rel =
      typeof filename === 'string' ? filename : new TextDecoder().decode(filename);
    const path = '/' + rel.replace(/^\/+/, '');
    if (isIgnored(path)) return;

    // Debounce per path — npm touches files in bursts
    clearTimeout(timers.get(path));
    timers.set(path, setTimeout(() => syncPath(wc, path), 400));
  };

  let watcher;
  try {
    watcher = wc.fs.watch('/', { recursive: true }, onEvent);
  } catch {
    // Fallback: top-level only (still covers package.json / lockfile)
    watcher = wc.fs.watch('/', onEvent);
  }

  return () => {
    watcher?.close?.();
    timers.forEach((t) => clearTimeout(t));
    timers.clear();
  };
}

function getProject() {
  const { project } = useIDEStore.getState();
  return project;
}

async function ensureFolder(path) {
  const store = useIDEStore.getState();
  const project = getProject();
  if (!project || store.getFile(path)) return;

  store.addFile({
    name: path.split('/').pop(),
    type: 'folder',
    path,
    content: '',
    language: 'plaintext',
  });
  await api
    .post(`/files/${project._id}`, { name: path.split('/').pop(), type: 'folder', path })
    .catch(() => {});
}

async function syncFile(wc, path) {
  const store = useIDEStore.getState();
  const project = getProject();
  if (!project) return;

  let content;
  try {
    content = await wc.fs.readFile(path, 'utf-8');
  } catch {
    return;
  }

  const existing = store.getFile(path);
  try {
    if (existing) {
      if (existing.content !== content) {
        store.updateFileContent(path, content);
        await api.put(`/files/${project._id}/save`, { path, content });
      }
    } else {
      const name = path.split('/').pop();
      store.addFile({ name, type: 'file', path, content, language: languageFromPath(path) });
      await api.post(`/files/${project._id}`, { name, type: 'file', path });
      await api.put(`/files/${project._id}/save`, { path, content });
    }
  } catch {
    // Network hiccups are non-fatal — the next change re-syncs
  }
}

/** Walk a directory and sync everything inside — scaffolders create whole
 *  trees but the watcher may only emit an event for the top folder. */
async function syncFolderDeep(wc, path) {
  let entries;
  try {
    entries = await wc.fs.readdir(path, { withFileTypes: true });
  } catch {
    return;
  }

  for (const ent of entries) {
    const childPath = (path === '/' ? '' : path) + '/' + ent.name;
    if (isIgnored(childPath)) continue;
    if (ent.isDirectory()) {
      await ensureFolder(childPath);
      await syncFolderDeep(wc, childPath);
    } else {
      await syncFile(wc, childPath);
    }
  }
}

async function syncPath(wc, path) {
  const store = useIDEStore.getState();
  if (!getProject()) return;

  // Directory check FIRST (readdir throws ENOTDIR on files) — readFile on a
  // directory is not a reliable signal in every fs implementation
  let isDir = false;
  let exists = false;
  try {
    await wc.fs.readdir(path);
    isDir = true;
    exists = true;
  } catch {
    try {
      await wc.fs.readFile(path);
      exists = true;
    } catch {
      exists = false;
    }
  }

  const existing = store.getFile(path);

  if (!exists) {
    if (existing) {
      store.removeFile(path);
      const project = getProject();
      if (project) {
        await api.delete(`/files/${project._id}`, { data: { path } }).catch(() => {});
      }
    }
    return;
  }

  if (isDir) {
    await ensureFolder(path);
    await syncFolderDeep(wc, path);
  } else {
    await syncFile(wc, path);
  }
}
