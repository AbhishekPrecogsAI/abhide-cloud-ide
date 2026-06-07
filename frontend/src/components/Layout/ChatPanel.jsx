import { useEffect, useRef, useState } from 'react';
import { Send, X, MessageSquare, SmilePlus } from 'lucide-react';
import {
  useChatMessages,
  useChatReactions,
  sendChatMessage,
  toggleReaction,
} from '../../lib/collab';
import { useAuthStore } from '../../store/authStore';

const QUICK_EMOJI = ['👍', '❤️', '😂', '🎉', '👀', '🔥'];

function time(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function Message({ m, mine, myUid, reactions }) {
  const [picker, setPicker] = useState(false);
  const entries = Object.entries(reactions || {}).filter(([, uids]) => uids.length);

  return (
    <div className={`group flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      {!mine && (
        <span className="font-mono text-[10px] font-semibold mb-0.5" style={{ color: m.color }}>
          {m.name}
        </span>
      )}

      <div className={`relative flex items-center gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
        <div
          className={`max-w-[210px] rounded-2xl px-3 py-1.5 text-[13px] leading-snug break-words ${
            mine
              ? 'bg-accent/15 border border-accent/20 rounded-br-md'
              : 'bg-white/[0.05] border border-white/10 rounded-bl-md'
          }`}
        >
          {m.text}
          <span className="ml-2 font-mono text-[9px] text-ink-faint align-baseline">
            {time(m.ts)}
          </span>
        </div>

        {/* add-reaction button (hover) */}
        {m.id && (
          <button
            onClick={() => setPicker((p) => !p)}
            className="opacity-0 group-hover:opacity-100 text-ink-faint hover:text-accent transition-all shrink-0"
            title="React"
          >
            <SmilePlus size={13} />
          </button>
        )}

        {/* quick emoji picker */}
        {picker && (
          <div
            className={`absolute -top-9 ${mine ? 'right-0' : 'left-0'} z-10 flex gap-0.5 glass-card rounded-full px-2 py-1`}
          >
            {QUICK_EMOJI.map((e) => (
              <button
                key={e}
                onClick={() => {
                  toggleReaction(m.id, e);
                  setPicker(false);
                }}
                className="text-[14px] hover:scale-125 transition-transform px-0.5"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* existing reactions */}
      {entries.length > 0 && (
        <div className={`flex gap-1 mt-1 ${mine ? 'flex-row-reverse' : ''}`}>
          {entries.map(([emoji, uids]) => (
            <button
              key={emoji}
              onClick={() => toggleReaction(m.id, emoji)}
              className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] border transition-all ${
                uids.includes(myUid)
                  ? 'bg-accent/15 border-accent/40'
                  : 'bg-white/[0.04] border-white/10 hover:border-white/25'
              }`}
            >
              {emoji}
              <span className="font-mono text-[9px] text-ink-dim">{uids.length}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ChatPanel({ onClose }) {
  const messages = useChatMessages();
  const reactions = useChatReactions();
  const user = useAuthStore((s) => s.user);
  const [text, setText] = useState('');
  const scrollRef = useRef(null);

  // Stick to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length]);

  function handleSend(e) {
    e.preventDefault();
    sendChatMessage(text);
    setText('');
  }

  return (
    <div className="fixed right-4 bottom-4 z-40 w-80 h-96 glass-card rounded-2xl flex flex-col overflow-hidden animate-fade-up">
      {/* Header */}
      <div className="h-10 shrink-0 flex items-center justify-between px-3.5 border-b border-white/[0.06]">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-ink-faint">
          <MessageSquare size={12} className="text-accent" />
          chat
        </span>
        <button onClick={onClose} className="text-ink-faint hover:text-ink transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 ? (
          <p className="font-mono text-[11px] text-ink-faint text-center pt-10">
            no messages yet — say hi 👋
          </p>
        ) : (
          messages.map((m, i) => (
            <Message
              key={m.id || i}
              m={m}
              mine={m.uid === user?._id}
              myUid={user?._id}
              reactions={reactions[m.id]}
            />
          ))
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="shrink-0 flex items-center gap-2 p-2.5 border-t border-white/[0.06]">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="message…"
          autoFocus
          className="flex-1 bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 text-[13px] outline-none placeholder:text-ink-faint focus:border-accent/40 transition-colors"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="text-accent disabled:text-ink-faint p-1.5 transition-colors"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
}
