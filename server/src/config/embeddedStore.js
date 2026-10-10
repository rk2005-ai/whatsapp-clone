import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');
const storeFile = path.join(dataDir, 'store.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let store = { users: [], conversations: [], messages: [] };

function loadStore() {
  try {
    if (fs.existsSync(storeFile)) {
      const raw = fs.readFileSync(storeFile, 'utf-8');
      store = JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load embedded store, initializing empty store:', e.message);
  }
}

function saveStore() {
  try {
    fs.writeFileSync(storeFile, JSON.stringify(store, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to persist embedded store:', e.message);
  }
}

loadStore();

export let isEmbeddedMode = false;
export function setEmbeddedMode(val) {
  isEmbeddedMode = val;
}

export function newId() {
  return crypto.randomBytes(12).toString('hex');
}

function matches(doc, filter = {}) {
  for (const [key, val] of Object.entries(filter)) {
    if (key === '_id') {
      const docId = String(doc._id);
      if (typeof val === 'object' && val !== null) {
        if (val.$ne && docId === String(val.$ne)) return false;
        if (val.$in && !val.$in.map(String).includes(docId)) return false;
      } else if (docId !== String(val)) {
        return false;
      }
    } else if (key === '$or') {
      const anyMatch = val.some((sub) => matches(doc, sub));
      if (!anyMatch) return false;
    } else if (key === 'participants') {
      const parts = (doc.participants || []).map((p) => String(p?._id || p));
      if (typeof val === 'object' && val !== null) {
        if (val.$all) {
          const allMatch = val.$all.every((p) => parts.includes(String(p)));
          if (!allMatch) return false;
        }
        if (val.$size !== undefined && parts.length !== val.$size) return false;
      } else if (!parts.includes(String(val))) {
        return false;
      }
    } else if (key === 'conversation') {
      if (String(doc.conversation) !== String(val)) return false;
    } else if (key === 'sender') {
      if (String(doc.sender) !== String(val)) return false;
    } else if (val && typeof val === 'object' && val.$regex) {
      const reg = new RegExp(val.$regex, val.$options || '');
      if (!reg.test(doc[key] || '')) return false;
    } else if (val && typeof val === 'object' && val.$lt) {
      const docDate = new Date(doc[key]);
      const targetDate = new Date(val.$lt);
      if (docDate >= targetDate) return false;
    } else if (doc[key] !== val) {
      return false;
    }
  }
  return true;
}

class SingleQuery {
  constructor(getDoc, populateFn = null) {
    this._getDoc = getDoc;
    this._populateFn = populateFn;
    this._populates = [];
  }
  select() {
    return this;
  }
  populate(arg, select) {
    if (typeof arg === 'string') this._populates.push({ path: arg, select });
    else if (typeof arg === 'object') this._populates.push(arg);
    return this;
  }
  async exec() {
    let doc = this._getDoc();
    if (doc && this._populateFn && this._populates.length) {
      doc = await this._populateFn(doc, this._populates);
    }
    return doc;
  }
  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

class Query {
  constructor(getDocs, populateFn = null) {
    this._getDocs = getDocs;
    this._populateFn = populateFn;
    this._limit = null;
    this._sort = null;
    this._selectFields = null;
    this._populates = [];
  }

  limit(n) {
    this._limit = n;
    return this;
  }

  sort(s) {
    this._sort = s;
    return this;
  }

  select(fields) {
    this._selectFields = fields;
    return this;
  }

  populate(arg, select) {
    if (typeof arg === 'string') {
      this._populates.push({ path: arg, select });
    } else if (typeof arg === 'object') {
      this._populates.push(arg);
    }
    return this;
  }

  async exec() {
    let list = this._getDocs();
    if (this._sort) {
      const entries = Object.entries(this._sort);
      list.sort((a, b) => {
        for (const [k, dir] of entries) {
          const av = new Date(a[k] || 0).getTime() || a[k] || 0;
          const bv = new Date(b[k] || 0).getTime() || b[k] || 0;
          if (av < bv) return dir === 1 || dir === 'asc' ? -1 : 1;
          if (av > bv) return dir === 1 || dir === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    if (this._limit) {
      list = list.slice(0, this._limit);
    }
    if (this._populateFn) {
      list = await Promise.all(list.map((item) => this._populateFn(item, this._populates)));
    }
    return list;
  }

  then(resolve, reject) {
    return this.exec().then(resolve, reject);
  }
}

function wrapDoc(raw, collectionName) {
  if (!raw) return null;
  const doc = { ...raw };
  if (doc.otpExpiresAt) {
    doc.otpExpiresAt = new Date(doc.otpExpiresAt);
  }
  Object.defineProperty(doc, 'id', {
    get() {
      return String(this._id);
    },
    enumerable: true
  });
  doc.toJSON = function () {
    const copy = { ...this };
    delete copy.passwordHash;
    delete copy.otpHash;
    delete copy.otpExpiresAt;
    delete copy.__v;
    return copy;
  };
  doc.save = async function () {
    loadStore();
    const list = store[collectionName];
    const idx = list.findIndex((item) => String(item._id) === String(this._id));
    this.updatedAt = new Date();
    const plain = {};
    for (const key of Object.keys(this)) {
      if (typeof this[key] !== 'function') {
        plain[key] = this[key];
      }
    }
    if (idx >= 0) {
      list[idx] = plain;
    } else {
      list.push(plain);
    }
    saveStore();
    return this;
  };
  doc.populate = async function (pathOrObj, select) {
    const populates = [typeof pathOrObj === 'string' ? { path: pathOrObj, select } : pathOrObj];
    return populateDoc(this, collectionName, populates);
  };
  return doc;
}

async function populateDoc(doc, collectionName, populates) {
  if (!doc) return null;
  loadStore();
  for (const pop of populates) {
    const pPath = typeof pop === 'string' ? pop : pop?.path;
    if (pPath === 'participants' && Array.isArray(doc.participants)) {
      doc.participants = doc.participants.map((pid) => {
        const u = store.users.find((x) => String(x._id) === String(pid?._id || pid));
        return u ? wrapDoc(u, 'users').toJSON() : pid;
      });
    } else if (pPath === 'sender') {
      const u = store.users.find((x) => String(x._id) === String(doc.sender?._id || doc.sender));
      if (u) {
        doc.sender = { _id: u._id, name: u.name, avatar: u.avatar };
      }
    } else if (pPath === 'lastMessage') {
      const m = store.messages.find((x) => String(x._id) === String(doc.lastMessage?._id || doc.lastMessage));
      if (m) {
        const msgDoc = wrapDoc(m, 'messages');
        const popSub = typeof pop === 'object' ? pop.populate?.path : null;
        if (popSub === 'sender') {
          const u = store.users.find((x) => String(x._id) === String(m.sender?._id || m.sender));
          msgDoc.sender = u ? { _id: u._id, name: u.name } : null;
        }
        doc.lastMessage = msgDoc;
      }
    }
  }
  return doc;
}

export const EmbeddedUser = {
  findOne(query) {
    loadStore();
    return new SingleQuery(() => {
      const found = store.users.find((u) => matches(u, query));
      return wrapDoc(found, 'users');
    });
  },
  async findById(id) {
    loadStore();
    const found = store.users.find((u) => String(u._id) === String(id));
    return wrapDoc(found, 'users');
  },
  find(query) {
    loadStore();
    return new Query(
      () => store.users.filter((u) => matches(u, query)).map((u) => wrapDoc(u, 'users')),
      (doc, populates) => populateDoc(doc, 'users', populates)
    );
  },
  async updateOne(query, update) {
    loadStore();
    const user = store.users.find((u) => matches(u, query));
    if (user && update.$set) {
      Object.assign(user, update.$set, { updatedAt: new Date() });
      saveStore();
    }
    return { acknowledged: true, modifiedCount: user ? 1 : 0 };
  },
  create(data) {
    loadStore();
    const doc = {
      _id: newId(),
      about: 'Hey there! I am using WhatsApp.',
      avatar: '',
      isOnline: false,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data
    };
    store.users.push(doc);
    saveStore();
    return wrapDoc(doc, 'users');
  }
};

export const EmbeddedConversation = {
  findOne(query) {
    loadStore();
    return new SingleQuery(
      () => {
        const found = store.conversations.find((c) => matches(c, query));
        return wrapDoc(found, 'conversations');
      },
      (d, pops) => populateDoc(d, 'conversations', pops)
    );
  },
  find(query) {
    loadStore();
    return new Query(
      () => store.conversations.filter((c) => matches(c, query)).map((c) => wrapDoc(c, 'conversations')),
      (doc, populates) => populateDoc(doc, 'conversations', populates)
    );
  },
  async exists(query) {
    loadStore();
    return store.conversations.some((c) => matches(c, query)) ? { _id: true } : null;
  },
  async create(data) {
    loadStore();
    const doc = {
      _id: newId(),
      isGroup: false,
      name: '',
      lastMessage: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data
    };
    store.conversations.push(doc);
    saveStore();
    return wrapDoc(doc, 'conversations');
  }
};

export const EmbeddedMessage = {
  findOne(query) {
    loadStore();
    return new SingleQuery(
      () => {
        const found = store.messages.find((m) => matches(m, query));
        return wrapDoc(found, 'messages');
      },
      (d, pops) => populateDoc(d, 'messages', pops)
    );
  },
  find(query) {
    loadStore();
    return new Query(
      () => store.messages.filter((m) => matches(m, query)).map((m) => wrapDoc(m, 'messages')),
      (doc, populates) => populateDoc(doc, 'messages', populates)
    );
  },
  async exists(query) {
    loadStore();
    return store.messages.some((m) => matches(m, query)) ? { _id: true } : null;
  },
  async create(data) {
    loadStore();
    const doc = {
      _id: newId(),
      type: 'text',
      text: '',
      attachmentUrl: '',
      replyTo: null,
      editedAt: null,
      deletedForEveryone: false,
      deliveredTo: [],
      readBy: [],
      reactions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data
    };
    store.messages.push(doc);
    saveStore();
    return wrapDoc(doc, 'messages');
  }
};
