import { z } from 'zod';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
export const listUsers = asyncHandler(async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ users: [] });
  const users = await User.find({ _id: { $ne: req.user.id }, $or: [{ name: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }, { phone: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') } }] }).limit(20);
  res.json({ users });
});
export const listConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find({ participants: req.user._id }).populate('participants', 'name phone avatar isOnline lastSeen').populate({ path: 'lastMessage', populate: { path: 'sender', select: 'name' } }).sort({ updatedAt: -1 });
  res.json({ conversations });
});
export const createConversation = asyncHandler(async (req, res) => {
  const parsed = z.object({ participantIds: z.array(z.string().min(1)).min(1).max(50), isGroup: z.boolean().optional(), name: z.string().trim().max(80).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Provide valid participantIds' });
  const ids = [...new Set([...parsed.data.participantIds, req.user.id])];
  const users = await User.find({ _id: { $in: ids } }).select('_id');
  if (users.length !== ids.length) return res.status(400).json({ message: 'One or more participants do not exist' });
  const isGroup = Boolean(parsed.data.isGroup);
  if (!isGroup && ids.length === 2) {
    const existing = await Conversation.findOne({ isGroup: false, participants: { $all: ids, $size: 2 } }).populate('participants', 'name phone avatar isOnline lastSeen');
    if (existing) return res.status(200).json({ conversation: existing });
  }
  const conversation = await Conversation.create({ participants: ids, isGroup, name: isGroup ? (parsed.data.name || 'New group') : '', createdBy: req.user._id });
  res.status(201).json({ conversation: await conversation.populate('participants', 'name phone avatar isOnline lastSeen') });
});
export const listMessages = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findOne({ _id: req.params.id, participants: req.user._id });
  if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const before = req.query.before ? new Date(req.query.before) : null;
  const filter = { conversation: conversation._id, ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { $lt: before } } : {}) };
  const messages = await Message.find(filter).populate('sender', 'name avatar').sort({ createdAt: -1 }).limit(limit);
  res.json({ messages: messages.reverse() });
});
export const sendMessage = asyncHandler(async (req, res) => {
  const parsed = z.object({
    text: z.string().trim().max(5000).optional(),
    type: z.enum(['text', 'image', 'file', 'audio', 'voice', 'doc', 'location']).optional(),
    attachmentUrl: z.string().max(2000000).optional(),
    replyTo: z.string().optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Invalid message payload' });
  const { text = '', type = 'text', attachmentUrl = '', replyTo } = parsed.data;
  if (!text && !attachmentUrl) return res.status(400).json({ message: 'Message text or attachment is required' });
  const conversation = await Conversation.findOne({ _id: req.params.id, participants: req.user._id });
  if (!conversation) return res.status(404).json({ message: 'Conversation not found' });
  if (replyTo && !(await Message.exists({ _id: replyTo, conversation: conversation._id }))) return res.status(400).json({ message: 'Reply target is not in this conversation' });
  const message = await Message.create({ conversation: conversation._id, sender: req.user._id, text, type, attachmentUrl, replyTo: replyTo || null, deliveredTo: [req.user._id] });
  conversation.lastMessage = message._id; conversation.updatedAt = new Date(); await conversation.save();
  const result = await message.populate('sender', 'name avatar');
  req.app.get('io')?.to(String(conversation._id)).emit('message:new', result);
  res.status(201).json({ message: result });
});
export const editMessage = asyncHandler(async (req, res) => {
  const parsed = z.object({ text: z.string().trim().min(1).max(5000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Message text is required' });
  const message = await Message.findOne({ _id: req.params.messageId, conversation: req.params.id, sender: req.user._id, deletedForEveryone: false });
  if (!message) return res.status(404).json({ message: 'Message not found or not yours' });
  message.text = parsed.data.text; message.editedAt = new Date(); await message.save();
  req.app.get('io')?.to(String(req.params.id)).emit('message:updated', message);
  res.json({ message });
});
export const deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findOne({ _id: req.params.messageId, conversation: req.params.id, sender: req.user._id });
  if (!message) return res.status(404).json({ message: 'Message not found or not yours' });
  message.deletedForEveryone = true; message.text = ''; message.attachmentUrl = ''; await message.save();
  req.app.get('io')?.to(String(req.params.id)).emit('message:deleted', { id: message.id, conversationId: req.params.id });
  res.json({ message });
});
