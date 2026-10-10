import mongoose from 'mongoose';
import { isEmbeddedMode, EmbeddedStatus } from '../config/embeddedStore.js';

const statusSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, default: '', maxlength: 500 },
  image: { type: String, default: '' },
  bg: { type: String, default: '#00a884' },
  viewedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now, expires: 86400 }
}, { timestamps: true });

const MongoStatus = mongoose.model('Status', statusSchema);

const StatusProxy = new Proxy(MongoStatus, {
  construct(_target, args) {
    if (isEmbeddedMode) {
      return EmbeddedStatus.create(...args);
    }
    return new MongoStatus(...args);
  },
  get(target, prop) {
    if (isEmbeddedMode && prop in EmbeddedStatus) {
      return EmbeddedStatus[prop];
    }
    return target[prop];
  }
});

export default StatusProxy;
