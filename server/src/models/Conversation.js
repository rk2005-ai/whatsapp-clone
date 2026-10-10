import mongoose from 'mongoose';
import { isEmbeddedMode, EmbeddedConversation } from '../config/embeddedStore.js';

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }],
  isGroup: { type: Boolean, default: false },
  name: { type: String, trim: true, maxlength: 80, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null }
}, { timestamps: true });
conversationSchema.index({ participants: 1, updatedAt: -1 });

const MongoConversation = mongoose.model('Conversation', conversationSchema);

const ConversationProxy = new Proxy(MongoConversation, {
  construct(_target, args) {
    if (isEmbeddedMode) {
      return EmbeddedConversation.create(...args);
    }
    return new MongoConversation(...args);
  },
  get(target, prop) {
    if (isEmbeddedMode && prop in EmbeddedConversation) {
      return EmbeddedConversation[prop];
    }
    return target[prop];
  }
});

export default ConversationProxy;
