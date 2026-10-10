import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';

export function configureSockets(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.sub);
      if (!user) return next(new Error('Invalid account'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = String(socket.user._id || socket.user.id);
    socket.join(`user:${userId}`);
    await User.updateOne({ _id: userId }, { $set: { isOnline: true } });

    socket.on('conversation:join', async (conversationId) => {
      if (typeof conversationId !== 'string') return;
      const allowed = await Conversation.exists({
        _id: conversationId,
        participants: socket.user._id
      });
      if (allowed) socket.join(conversationId);
    });

    socket.on('typing:start', async (conversationId) => {
      if (typeof conversationId !== 'string') return;
      const allowed = await Conversation.exists({
        _id: conversationId,
        participants: socket.user._id
      });
      if (allowed) {
        socket.to(conversationId).emit('typing:update', { conversationId, userId, typing: true });
      }
    });

    socket.on('typing:stop', (conversationId) => {
      if (typeof conversationId === 'string') {
        socket.to(conversationId).emit('typing:update', { conversationId, userId, typing: false });
      }
    });

    // WebRTC Calling Signaling Events
    socket.on('call:invite', ({ toUserId, type = 'video', conversationId, callId }) => {
      const targetId = String(toUserId || '').trim();
      if (!targetId || targetId === userId) return;
      console.log(`[Socket] Call invite: ${userId} -> ${targetId} (${type})`);
      io.to(`user:${targetId}`).emit('call:incoming', {
        fromUser: socket.user.toJSON(),
        type,
        conversationId,
        callId
      });
    });

    socket.on('call:accept', ({ toUserId, callId }) => {
      const targetId = String(toUserId || '').trim();
      if (!targetId || targetId === userId) return;
      console.log(`[Socket] Call accept: ${userId} -> ${targetId}`);
      io.to(`user:${targetId}`).emit('call:accepted', {
        fromUserId: userId,
        callId
      });
    });

    socket.on('call:reject', ({ toUserId, callId }) => {
      const targetId = String(toUserId || '').trim();
      if (!targetId || targetId === userId) return;
      console.log(`[Socket] Call reject: ${userId} -> ${targetId}`);
      io.to(`user:${targetId}`).emit('call:rejected', {
        fromUserId: userId,
        callId
      });
    });

    socket.on('call:signal', ({ toUserId, signal, callId }) => {
      const targetId = String(toUserId || '').trim();
      if (!targetId || !signal || targetId === userId) return;
      console.log(`[Socket] Signal (${signal.type}): ${userId} -> ${targetId}`);
      io.to(`user:${targetId}`).emit('call:signal', {
        fromUserId: userId,
        signal,
        callId
      });
    });

    socket.on('call:end', ({ toUserId, callId }) => {
      const targetId = String(toUserId || '').trim();
      if (!targetId || targetId === userId) return;
      console.log(`[Socket] Call end: ${userId} -> ${targetId}`);
      io.to(`user:${targetId}`).emit('call:ended', {
        fromUserId: userId,
        callId
      });
    });

    socket.on('disconnect', async () => {
      const sockets = await io.in(`user:${userId}`).fetchSockets();
      if (!sockets.length) {
        await User.updateOne({ _id: userId }, { $set: { isOnline: false, lastSeen: new Date() } });
        io.emit('presence:update', { userId, isOnline: false, lastSeen: new Date() });
      }
    });

    io.emit('presence:update', { userId, isOnline: true });
  });
}
