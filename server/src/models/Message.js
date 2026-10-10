import mongoose from 'mongoose';
import { isEmbeddedMode, EmbeddedMessage } from '../config/embeddedStore.js';

const messageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['text', 'image', 'file', 'audio'], default: 'text' },
  text: { type: String, trim: true, maxlength: 5000, default: '' },
  attachmentUrl: { type: String, default: '' },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  editedAt: { type: Date, default: null },
  deletedForEveryone: { type: Boolean, default: false },
  readBy: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, readAt: { type: Date, default: Date.now } }],
  deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reactions: [{ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, emoji: { type: String, maxlength: 16 } }]
}, { timestamps: true });
messageSchema.index({ conversation: 1, createdAt: -1 });

const MongoMessage = mongoose.model('Message', messageSchema);

const MessageProxy = new Proxy(MongoMessage, {
  construct(_target, args) {
    if (isEmbeddedMode) {
      return EmbeddedMessage.create(...args);
    }
    return new MongoMessage(...args);
  },
  get(target, prop) {
    if (isEmbeddedMode && prop in EmbeddedMessage) {
      return EmbeddedMessage[prop];
    }
    return target[prop];
  }
});

export default MessageProxy;
