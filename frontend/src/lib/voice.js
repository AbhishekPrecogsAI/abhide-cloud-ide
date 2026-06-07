import { useSyncExternalStore } from 'react';
import { setVoicePresence } from './collab';
import { getSocketBaseUrl } from './apiBase';

// WebRTC voice mesh. Signaling relays through our backend at /rtc/<projectId>.
// Strategy: the JOINING client offers to every existing member (no glare).

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

const listeners = new Set();
let state = { inVoice: false, joining: false, muted: false, peers: [] };
function setState(patch) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
export function useVoice() {
  return useSyncExternalStore(
    (cb) => (listeners.add(cb), () => listeners.delete(cb)),
    () => state
  );
}

let ws = null;
let localStream = null;
const pcs = new Map(); // peerId -> { pc, audio }

function send(msg) {
  if (ws?.readyState === 1) ws.send(JSON.stringify(msg));
}

function makePC(peerId) {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
  pc.onicecandidate = (e) => {
    if (e.candidate) send({ type: 'signal', to: peerId, data: { candidate: e.candidate } });
  };

  const audio = document.createElement('audio');
  audio.autoplay = true;
  pc.ontrack = (e) => {
    audio.srcObject = e.streams[0];
  };
  document.body.appendChild(audio);

  pcs.set(peerId, { pc, audio });
  return pc;
}

async function offerTo(peerId) {
  const pc = makePC(peerId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  send({ type: 'signal', to: peerId, data: { sdp: pc.localDescription } });
}

async function handleSignal(from, data) {
  const pc = pcs.get(from)?.pc || makePC(from);
  try {
    if (data.sdp) {
      await pc.setRemoteDescription(data.sdp);
      if (data.sdp.type === 'offer') {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        send({ type: 'signal', to: from, data: { sdp: pc.localDescription } });
      }
    } else if (data.candidate) {
      await pc.addIceCandidate(data.candidate);
    }
  } catch (err) {
    console.warn('rtc signal error', err);
  }
}

function closePeer(id) {
  const entry = pcs.get(id);
  if (!entry) return;
  entry.pc.close();
  entry.audio.remove();
  pcs.delete(id);
}

export async function joinVoice(projectId, token, user, options = {}) {
  const { requirePeer = false } = options;
  if (ws || state.joining) return;
  setState({ joining: true });

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    setState({ joining: false });
    alert('Microphone access is required for voice chat');
    return;
  }

  const wsBase = getSocketBaseUrl();
  ws = new WebSocket(`${wsBase}/rtc/${projectId}?token=${token}`);

  ws.onopen = () =>
    send({ type: 'join', user: { name: user?.username || 'anon', color: user?.color } });

  ws.onmessage = async (e) => {
    const msg = JSON.parse(e.data);
    if (msg.type === 'peers') {
      if (requirePeer && msg.peers.length === 0) {
        leaveVoice();
        return;
      }
      setState({ inVoice: true, joining: false, peers: msg.peers });
      setVoicePresence(true); // others see me "in call" → their phone rings
      for (const p of msg.peers) await offerTo(p.id); // newcomer initiates
    } else if (msg.type === 'peer-joined') {
      setState({ peers: [...state.peers, { id: msg.id, user: msg.user }] });
    } else if (msg.type === 'peer-left') {
      closePeer(msg.id);
      const peers = state.peers.filter((p) => p.id !== msg.id);
      if (peers.length === 0) {
        leaveVoice();
        return;
      }
      setState({ peers });
    } else if (msg.type === 'signal') {
      await handleSignal(msg.from, msg.data);
    }
  };

  ws.onclose = () => {
    if (ws) leaveVoice(); // server dropped us
  };
}

export function toggleMute() {
  if (!localStream) return;
  const muted = !state.muted;
  localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
  setState({ muted });
}

export function leaveVoice() {
  pcs.forEach((_, id) => closePeer(id));
  pcs.clear();
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  if (ws) {
    const w = ws;
    ws = null;
    try {
      w.close();
    } catch {
      /* already closed */
    }
  }
  setVoicePresence(false);
  setState({ inVoice: false, joining: false, muted: false, peers: [] });
}

// ---- ringtone (WebAudio — no asset needed) ----------------------------------
let ringCtx = null;
let ringTimer = null;

function beep(ctx) {
  const t = ctx.currentTime;
  for (const [start, freq] of [
    [0, 740],
    [0.18, 880],
  ]) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t + start);
    g.gain.exponentialRampToValueAtTime(0.08, t + start + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + start + 0.35);
    o.start(t + start);
    o.stop(t + start + 0.4);
  }
}

export function startRing() {
  if (ringCtx) return;
  try {
    ringCtx = new (window.AudioContext || window.webkitAudioContext)();
    ringCtx.resume().catch(() => {});
    beep(ringCtx);
    ringTimer = setInterval(() => ringCtx && beep(ringCtx), 2200);
  } catch {
    /* audio blocked — banner is still visible */
  }
}

export function stopRing() {
  clearInterval(ringTimer);
  ringTimer = null;
  ringCtx?.close().catch(() => {});
  ringCtx = null;
}
