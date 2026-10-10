import { io } from 'socket.io-client';
import { getStoredToken } from './client.js';

let socket = null;
const listeners = new Map();

export function initSocket() {
  const token = getStoredToken();
  if (!token) {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    return null;
  }

  if (socket && socket.connected) {
    return socket;
  }

  // Connect via relative path so Vite proxy handles port 5000 and ws upgrade seamlessly
  socket = io(window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
  });

  socket.on('connect', () => {
    // Re-attach active listeners
    for (const [event, cbs] of listeners.entries()) {
      for (const cb of cbs) {
        socket.on(event, cb);
      }
    }
  });

  socket.on('connect_error', (err) => {
    console.warn('Socket connection error:', err.message);
  });

  return socket;
}

export function getSocket() {
  if (!socket) return initSocket();
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function joinConversation(conversationId) {
  const s = getSocket();
  if (s) s.emit('conversation:join', conversationId);
}

export function sendTypingStart(conversationId) {
  const s = getSocket();
  if (s) s.emit('typing:start', conversationId);
}

export function sendTypingStop(conversationId) {
  const s = getSocket();
  if (s) s.emit('typing:stop', conversationId);
}

// WebRTC Signaling methods
export function sendCallInvite({ toUserId, type, conversationId, callId }) {
  const s = getSocket();
  if (s) s.emit('call:invite', { toUserId, type, conversationId, callId });
}

export function sendCallAccept({ toUserId, callId }) {
  const s = getSocket();
  if (s) s.emit('call:accept', { toUserId, callId });
}

export function sendCallReject({ toUserId, callId }) {
  const s = getSocket();
  if (s) s.emit('call:reject', { toUserId, callId });
}

export function sendCallSignal({ toUserId, signal, callId }) {
  const s = getSocket();
  if (s) s.emit('call:signal', { toUserId, signal, callId });
}

export function sendCallEnd({ toUserId, callId }) {
  const s = getSocket();
  if (s) s.emit('call:end', { toUserId, callId });
}

export function subscribeSocket(event, callback) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(callback);

  const s = getSocket();
  if (s) {
    s.on(event, callback);
  }

  return () => {
    listeners.get(event)?.delete(callback);
    const curr = getSocket();
    if (curr) curr.off(event, callback);
  };
}
