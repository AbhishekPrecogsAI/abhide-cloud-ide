import { useSyncExternalStore } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { getSocketBaseUrl } from './apiBase';

// One collab session per open project. Each file's content lives in a Y.Text
// keyed by its path; Monaco binds to the active one (see EditorPanel).

const COLORS = ['#6ee7b7', '#7dd3fc', '#c4b5fd', '#fbbf24', '#f472b6', '#fb923c'];

let session = null; // { doc, provider, projectId, observed:Set, onRemoteChange }

// -- tiny external stores for React ------------------------------------------
const readyListeners = new Set();
let ready = false;
function setReady(v) {
  ready = v;
  readyListeners.forEach((l) => l());
}
export function useCollabReady() {
  return useSyncExternalStore(
    (cb) => (readyListeners.add(cb), () => readyListeners.delete(cb)),
    () => ready
  );
}

const peerListeners = new Set();
let peersSnapshot = [];
function refreshPeers() {
  if (!session) {
    peersSnapshot = [];
  } else {
    const myClientId = session.provider.awareness.clientID;
    const states = [...session.provider.awareness.getStates().entries()];
    peersSnapshot = states
      .filter(([, s]) => s.user)
      .map(([clientId, s]) => ({
        clientId,
        isSelf: clientId === myClientId,
        voice: !!s.voice?.in,
        ...s.user,
      }));
  }
  peerListeners.forEach((l) => l());
}

/** Broadcast whether I'm in the voice room (drives "ringing" on other clients) */
export function setVoicePresence(inVoice) {
  session?.provider.awareness.setLocalStateField('voice', inVoice ? { in: true } : null);
}
export function usePeers() {
  return useSyncExternalStore(
    (cb) => (peerListeners.add(cb), () => peerListeners.delete(cb)),
    () => peersSnapshot
  );
}

// -- chat (a Y.Array in the same shared doc) ----------------------------------
const chatListeners = new Set();
let chatSnapshot = [];
const reactListeners = new Set();
let reactSnapshot = {};

function bindChat() {
  const arr = session.doc.getArray('chat');
  const update = () => {
    chatSnapshot = arr.toArray();
    chatListeners.forEach((l) => l());
  };
  arr.observe(update);
  update();

  const rmap = session.doc.getMap('chatReactions');
  const rupdate = () => {
    reactSnapshot = Object.fromEntries(rmap.entries());
    reactListeners.forEach((l) => l());
  };
  rmap.observe(rupdate);
  rupdate();
}

export function useChatMessages() {
  return useSyncExternalStore(
    (cb) => (chatListeners.add(cb), () => chatListeners.delete(cb)),
    () => chatSnapshot
  );
}

export function useChatReactions() {
  return useSyncExternalStore(
    (cb) => (reactListeners.add(cb), () => reactListeners.delete(cb)),
    () => reactSnapshot
  );
}

export function sendChatMessage(text) {
  if (!session || !text.trim()) return;
  const me = session.provider.awareness.getLocalState()?.user || {};
  session.doc.getArray('chat').push([
    {
      id: crypto.randomUUID(),
      uid: me.uid || '',
      name: me.name || 'anon',
      color: me.color || '#6ee7b7',
      text: text.trim(),
      ts: Date.now(),
    },
  ]);
}

/** Toggle my reaction on a message. Stored as { msgId: { '👍': [uid, …] } }. */
export function toggleReaction(msgId, emoji) {
  if (!session) return;
  const me = session.provider.awareness.getLocalState()?.user;
  if (!me?.uid) return;
  const rmap = session.doc.getMap('chatReactions');
  const cur = { ...(rmap.get(msgId) || {}) };
  const uids = new Set(cur[emoji] || []);
  uids.has(me.uid) ? uids.delete(me.uid) : uids.add(me.uid);
  if (uids.size) cur[emoji] = [...uids];
  else delete cur[emoji];
  rmap.set(msgId, cur);
}

// Inject per-client cursor colors for y-monaco's remote selection classes
function applyCursorStyles() {
  if (!session) return;
  let style = document.getElementById('yjs-cursor-styles');
  if (!style) {
    style = document.createElement('style');
    style.id = 'yjs-cursor-styles';
    document.head.appendChild(style);
  }
  const rules = [];
  session.provider.awareness.getStates().forEach((state, clientId) => {
    if (!state.user) return;
    rules.push(
      `.yRemoteSelection-${clientId}{background-color:${state.user.color}33;}`,
      `.yRemoteSelectionHead-${clientId}{border-left:2px solid ${state.user.color};position:relative;}`,
      `.yRemoteSelectionHead-${clientId}::after{content:'${state.user.name.replace(/'/g, '')}';position:absolute;top:-1.9em;left:-2px;background:${state.user.color};color:#0a0a0c;font-size:9px;line-height:1.5;font-family:'JetBrains Mono',monospace;padding:0 4px;border-radius:3px 3px 3px 0;white-space:nowrap;pointer-events:none;z-index:10;}`
    );
  });
  style.textContent = rules.join('\n');
}

// -- session lifecycle --------------------------------------------------------
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function initCollab(project, user, token, { onRemoteChange, getFiles }) {
  destroyCollab();

  const doc = new Y.Doc();
  const wsBase = getSocketBaseUrl();
  const provider = new WebsocketProvider(`${wsBase}/yjs`, project._id, doc, {
    params: { token },
  });

  session = { doc, provider, projectId: project._id, observed: new Set(), onRemoteChange };
  bindChat();

  provider.awareness.setLocalStateField('user', {
    uid: user?._id || '',
    name: user?.username || 'anon',
    color: COLORS[hashStr(user?._id || 'x') % COLORS.length],
  });

  provider.awareness.on('change', () => {
    refreshPeers();
    applyCursorStyles();
  });

  provider.on('sync', (synced) => {
    if (!synced) return;
    // First client seeds empty Y.Texts from the DB-loaded content
    const files = getFiles().filter((f) => f.type === 'file');
    doc.transact(() => {
      for (const f of files) {
        const t = doc.getText(f.path);
        if (t.length === 0 && f.content) t.insert(0, f.content);
      }
    });
    files.forEach((f) => observeText(f.path));
    setReady(true);
    refreshPeers();
  });

  return session;
}

function observeText(path) {
  if (!session || session.observed.has(path)) return;
  session.observed.add(path);
  const t = session.doc.getText(path);
  t.observe(() => {
    session?.onRemoteChange?.(path, t.toString());
  });
}

/** Y.Text for a file — seeds from `fallback` if empty (new/unsynced file). */
export function getYText(path, fallback = '') {
  if (!session) return null;
  const t = session.doc.getText(path);
  if (ready && t.length === 0 && fallback) t.insert(0, fallback);
  observeText(path);
  return t;
}

export function getAwareness() {
  return session?.provider.awareness || null;
}

export function destroyCollab() {
  if (!session) return;
  session.provider.destroy();
  session.doc.destroy();
  session = null;
  setReady(false);
  refreshPeers();
  chatSnapshot = [];
  chatListeners.forEach((l) => l());
  reactSnapshot = {};
  reactListeners.forEach((l) => l());
  document.getElementById('yjs-cursor-styles')?.remove();
}
