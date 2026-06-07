import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  SquareTerminal,
  Loader2,
  UserPlus,
  X,
  MessageSquare,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
} from 'lucide-react';
import { useIDEStore } from '../../store/ideStore';
import { useAuthStore } from '../../store/authStore';
import { usePeers, useChatMessages } from '../../lib/collab';
import { useVoice, joinVoice, leaveVoice, toggleMute, startRing, stopRing } from '../../lib/voice';
import api from '../../lib/api';
import { Logo } from '../Logo.jsx';
import ChatPanel from './ChatPanel.jsx';

function InviteModal({ project, onClose }) {
  const [identifier, setIdentifier] = useState('');
  const [result, setResult] = useState(null); // { ok, message }
  const [busy, setBusy] = useState(false);

  async function handleInvite(e) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      const { data } = await api.post(`/projects/${project._id}/invite`, { identifier });
      setResult({ ok: true, message: data.message });
      setIdentifier('');
    } catch (err) {
      setResult({ ok: false, message: err.response?.data?.message || 'Invite failed' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <form
        onSubmit={handleInvite}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm glass-card rounded-2xl p-6 animate-fade-up"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold">Invite a collaborator</h2>
          <button type="button" onClick={onClose} className="text-ink-faint hover:text-ink">
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-ink-dim mb-5">
          They get live edit access — same code, cursors and all.
        </p>

        {result && (
          <p
            className={`mb-4 text-xs font-mono rounded-lg px-3 py-2 border ${
              result.ok
                ? 'text-accent bg-accent/10 border-accent/20'
                : 'text-red-400 bg-red-400/10 border-red-400/20'
            }`}
          >
            {result.message}
          </p>
        )}

        <input
          className="input-glass mb-4"
          placeholder="friend's email or username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          autoFocus
        />
        <button type="submit" className="btn-glow w-full flex items-center justify-center gap-2" disabled={busy}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
          Invite
        </button>
      </form>
    </div>
  );
}

const SAVE_LABELS = {
  saved: { text: 'saved', class: 'text-ink-faint' },
  saving: { text: 'saving…', class: 'text-yellow-300' },
  unsaved: { text: 'unsaved', class: 'text-yellow-300' },
};

export default function TopBar() {
  const {
    project,
    saveStatus,
    terminalWriter,
    running,
    setRunning,
    previewUrl,
    previewServers,
    terminalOpen,
    toggleTerminal,
  } = useIDEStore();
  const save = SAVE_LABELS[saveStatus] || SAVE_LABELS.saved;
  const peers = usePeers();
  const [showInvite, setShowInvite] = useState(false);

  // Chat (unread badge) + voice
  const messages = useChatMessages();
  const [chatOpen, setChatOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  const voice = useVoice();
  const { user, token } = useAuthStore();

  // Only OTHER people's messages count as unread
  const unread = chatOpen
    ? 0
    : messages.slice(seenCount).filter((m) => m.uid !== user?._id).length;

  function toggleChat() {
    setChatOpen((open) => {
      setSeenCount(messages.length);
      return !open;
    });
  }
  // While the panel is open, everything is seen
  useEffect(() => {
    if (chatOpen) setSeenCount(messages.length);
  }, [chatOpen, messages.length]);

  // Incoming call: someone else is in voice, I'm not → ring until accept/decline
  const othersInVoice = peers.filter((p) => !p.isSelf && p.voice);
  const [declined, setDeclined] = useState(false);
  const ringing = othersInVoice.length > 0 && !voice.inVoice && !voice.joining && !declined;

  useEffect(() => {
    // call ended for everyone → re-arm ringing for the next call
    if (othersInVoice.length === 0 && declined) setDeclined(false);
  }, [othersInVoice.length, declined]);

  useEffect(() => {
    if (ringing) startRing();
    else stopRing();
    return stopRing;
  }, [ringing]);

  // Real lifecycle: idle → starting (command sent, no server yet) → live (port open)
  const isLive = Object.keys(previewServers).length > 0;
  const isStarting = running && !isLive;

  function handleRun() {
    if (!terminalWriter || running) return;
    setRunning(true);
    // Drive the visible shell so install/dev output streams in the terminal
    terminalWriter('npm install && npm run dev\r');
  }

  return (
    <header className="h-10 shrink-0 bg-surface-1 border-b border-subtle flex items-center px-3 gap-3">
      <Link to="/" className="hover:opacity-80 transition-opacity" title="Back to projects">
        <Logo size="sm" />
      </Link>

      <span className="text-ink-faint">/</span>
      <span className="font-mono text-sm text-ink-dim truncate">{project?.name}</span>

      <span className={`font-mono text-[11px] ${save.class} flex items-center gap-1.5`}>
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            saveStatus === 'saved' ? 'bg-accent' : 'bg-yellow-300'
          }`}
        />
        {save.text}
      </span>

      <div className="flex-1" />

      {previewUrl && (
        <span className="font-mono text-[11px] text-ink-faint hidden md:block truncate max-w-[200px]">
          {previewUrl}
        </span>
      )}

      {/* Presence — everyone connected to this project right now */}
      {peers.length > 0 && (
        <div className="flex items-center -space-x-1.5 mr-1">
          {peers.slice(0, 5).map((p) => (
            <span
              key={p.clientId}
              title={p.name}
              className="w-[22px] h-[22px] rounded-full grid place-items-center font-mono text-[10px] font-bold border-2 border-surface-1"
              style={{ background: p.color, color: '#0a0a0c' }}
            >
              {p.name?.[0]?.toUpperCase() || '?'}
            </span>
          ))}
          {peers.length > 5 && (
            <span className="font-mono text-[10px] text-ink-faint pl-2">
              +{peers.length - 5}
            </span>
          )}
        </div>
      )}

      <button
        onClick={() => setShowInvite(true)}
        title="Invite a collaborator"
        className="text-ink-faint hover:text-accent p-1.5 transition-colors"
      >
        <UserPlus size={15} />
      </button>

      {/* Chat */}
      <button
        onClick={toggleChat}
        title="Project chat"
        className={`relative p-1.5 transition-colors ${
          chatOpen ? 'text-accent' : 'text-ink-faint hover:text-accent'
        }`}
      >
        <MessageSquare size={15} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-accent text-surface-0 font-mono text-[9px] font-bold grid place-items-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Voice */}
      {voice.inVoice ? (
        <span className="flex items-center gap-1 bg-accent/10 border border-accent/30 rounded-md px-1.5 py-1">
          <button
            onClick={toggleMute}
            title={voice.muted ? 'Unmute' : 'Mute'}
            className={voice.muted ? 'text-red-400' : 'text-accent'}
          >
            {voice.muted ? <MicOff size={13} /> : <Mic size={13} />}
          </button>
          {voice.peers.length > 0 && (
            <span className="font-mono text-[10px] text-accent">{voice.peers.length + 1}</span>
          )}
          <button
            onClick={leaveVoice}
            title="Leave voice"
            className="text-ink-dim hover:text-red-400 transition-colors"
          >
            <PhoneOff size={13} />
          </button>
        </span>
      ) : (
        <button
          onClick={() => joinVoice(project._id, token, user)}
          disabled={voice.joining}
          title="Join voice chat"
          className="text-ink-faint hover:text-accent p-1.5 transition-colors disabled:opacity-50"
        >
          {voice.joining ? <Loader2 size={15} className="animate-spin" /> : <Phone size={15} />}
        </button>
      )}

      <button
        onClick={toggleTerminal}
        title={`${terminalOpen ? 'Hide' : 'Show'} terminal (Ctrl+\`)`}
        className={`rounded-md p-1.5 border transition-colors ${
          terminalOpen
            ? 'text-accent border-accent/30 bg-accent/5'
            : 'text-ink-faint border-subtle hover:text-ink'
        }`}
      >
        <SquareTerminal size={15} />
      </button>

{isLive ? (
        <span className="font-mono text-xs font-semibold rounded-md px-3.5 py-1.5 flex items-center gap-1.5 bg-accent/10 text-accent border border-accent/30">
          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
          live
        </span>
      ) : (
        <button
          onClick={handleRun}
          disabled={!terminalWriter || isStarting}
          className={`font-mono text-xs font-semibold rounded-md px-3.5 py-1.5 transition-all flex items-center gap-1.5
            ${
              isStarting
                ? 'bg-surface-3 text-ink-dim cursor-default'
                : 'bg-accent text-surface-0 hover:brightness-110 active:scale-[0.97]'
            }`}
        >
          {isStarting ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              starting…
            </>
          ) : (
            <>
              <Play size={12} fill="currentColor" />
              Run
            </>
          )}
        </button>
      )}

      {showInvite && <InviteModal project={project} onClose={() => setShowInvite(false)} />}
      {chatOpen && <ChatPanel onClose={toggleChat} />}

      {/* Incoming call banner */}
      {ringing && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 glass-card rounded-2xl px-5 py-3.5 flex items-center gap-4 animate-fade-up shadow-2xl shadow-black/60">
          <span className="relative grid place-items-center w-9 h-9 rounded-full bg-accent/15">
            <Phone size={16} className="text-accent" />
            <span className="absolute inset-0 rounded-full border border-accent/40 animate-ping" />
          </span>
          <div className="mr-2">
            <p className="text-sm font-semibold">
              {othersInVoice.map((p) => p.name).join(', ')}
            </p>
            <p className="font-mono text-[11px] text-ink-dim">
              {othersInVoice.length > 1 ? 'are' : 'is'} in the voice call…
            </p>
          </div>
          <button
            onClick={() => joinVoice(project._id, token, user)}
            className="flex items-center gap-1.5 bg-accent text-surface-0 font-semibold text-xs rounded-lg px-3.5 py-2 hover:brightness-110 active:scale-[0.97] transition-all"
          >
            <Phone size={12} />
            Accept
          </button>
          <button
            onClick={() => setDeclined(true)}
            title="Decline (silence the ring)"
            className="flex items-center gap-1.5 bg-red-400/10 text-red-400 border border-red-400/20 font-semibold text-xs rounded-lg px-3.5 py-2 hover:bg-red-400/20 transition-all"
          >
            <PhoneOff size={12} />
            Decline
          </button>
        </div>
      )}
    </header>
  );
}
