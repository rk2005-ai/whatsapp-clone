import mongoose from 'mongoose';
import { isEmbeddedMode, EmbeddedUser } from '../config/embeddedStore.js';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 60 },
  phone: { type: String, required: true, unique: true, index: true },
  about: { type: String, default: 'Hey there! I am using WhatsApp.', maxlength: 140 },
  avatar: { type: String, default: '' },
  passwordHash: { type: String, select: false },
  otpHash: { type: String, select: false },
  otpExpiresAt: { type: Date, select: false },
  lastSeen: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false }
}, { timestamps: true, toJSON: { transform(_doc, ret) { delete ret.passwordHash; delete ret.otpHash; delete ret.otpExpiresAt; delete ret.__v; return ret; } } });

const MongoUser = mongoose.model('User', userSchema);

const UserProxy = new Proxy(MongoUser, {
  construct(_target, args) {
    if (isEmbeddedMode) {
      return EmbeddedUser.create(...args);
    }
    return new MongoUser(...args);
  },
  get(target, prop) {
    if (isEmbeddedMode && prop in EmbeddedUser) {
      return EmbeddedUser[prop];
    }
    return target[prop];
  }
});

export default UserProxy;
