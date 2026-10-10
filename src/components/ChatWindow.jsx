import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Search,
  Smile,
  Paperclip,
  Mic,
  Send,
  Check,
  CheckCheck,
  X,
  Trash2,
  Image as Img,
  FileText,
  MapPin,
  Reply,
  Pencil,
  Copy,
  ChevronDown,
  Play,
  Pause,
  Pin,
  Star,
  Info,
  XCircle
} from 'lucide-react';
import Avatar from './Avatar.jsx';
import { fmtTime, dayLabel, fmtDur, lastSeenText, preview } from '../utils/format.js';

const EMOJIS = '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😎 🤩 🥳 😏 😌 😴 🤔 🤗 😢 😭 😡 🥺 😱 🙄 👍 👎 👏 🙌 🙏 💪 👋 🤝 ✌️ 👌 ❤️ 🧡 💛 💚 💙 💜 🔥 ✨ 🎉 💯 ✅ ❌ ☕ 🍕 🎂 🚀 🌅 🏔️'.split(' ');
const REACTS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

function Ticks({ s, receipts }) {
  if (!s) return null;
  if (s === 'sent') return <Check size={15} className="tick" aria-label="Sent" />;
  return (
    <CheckCheck
      size={15}
      className={`tick ${s === 'read' && receipts ? 'blue' : ''}`}
      aria-label={s === 'read' ? 'Read' : 'Delivered'}
    />
  );
}

function Voice({ dur = 1, mine, src }) {
  const [on, setOn] = useState(false);
  const [p, setP] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) return;
    const a = audioRef.current;
    const handleTime = () => setP(a.currentTime);
    const handleEnd = () => {
      setOn(false);
      setP(0);
    };
    a.addEventListener('timeupdate', handleTime);
    a.addEventListener('ended', handleEnd);
    return () => {
      a.removeEventListener('timeupdate', handleTime);
      a.removeEventListener('ended', handleEnd);
    };
  }, []);

  const toggle = () => {
    if (!audioRef.current) return;
    if (on) {
      audioRef.current.pause();
      setOn(false);
    } else {
      audioRef.current.play().then(() => setOn(true)).catch(() => setOn(true));
    }
  };

  const bars = [...Array(24)].map((_, i) => 6 + ((i * 7 + 3) % 5) * 4);
  const total = dur || (audioRef.current?.duration ? Math.ceil(audioRef.current.duration) : 1);

  return (
    <div className="voice">
      {src && <audio ref={audioRef} src={src} preload="metadata" />}
      <button
        className="icon-btn"
        type="button"
        aria-label={on ? 'Pause voice message' : 'Play voice message'}
        onClick={toggle}
      >
        {on ? <Pause size={22} /> : <Play size={22} />}
      </button>
      <div className="wave">
        {bars.map((h, i) => (
          <i
            key={i}
            style={{
              height: h,
              opacity: (i / bars.length) * total <= p && p > 0 ? 1 : 0.45
            }}
          />
        ))}
      </div>
      <span className="vdur">{fmtDur(on ? Math.ceil(p) : total)}</span>
    </div>
  );
}

function Bubble({ m, chat, mine, group, receipts, act }) {
  const [open, setOpen] = useState(false);
  const orig = m.replyTo && chat.messages.find((x) => x.id === m.replyTo);
  const close = () => setOpen(false);

  return (
    <div className={`msg ${mine ? 'out' : 'in'}`}>
      <div className={`bubble ${m.type === 'image' ? 'media' : ''}`}>
        {group && !mine && m.sender && <div className="sender">{m.sender}</div>}
        {orig && (
          <div className="quote">
            <b>{orig.from === 'me' ? 'You' : orig.sender || 'Them'}</b>
            <span>{preview(orig)}</span>
          </div>
        )}
        {m.deleted ? (
          <span className="deleted">🚫 This message was deleted</span>
        ) : (
          <>
            {m.type === 'image' && <img className="photo" src={m.src} alt="Shared" />}
            {m.type === 'voice' && <Voice dur={m.dur} mine={mine} src={m.src} />}
            {m.type === 'doc' && (
              <div className="doc">
                <FileText size={28} />
                <div>
                  <div>{m.text}</div>
                  <small>{m.size || 'Document'}</small>
                </div>
              </div>
            )}
            {m.type === 'location' && (
              <div className="doc">
                <MapPin size={28} />
                <div>
                  <div>Shared location</div>
                  <small>{m.text}</small>
                </div>
              </div>
            )}
            {m.type === 'text' && <span className="txt">{m.text}</span>}
          </>
        )}
        <span className="meta">
          {m.edited && !m.deleted && <i>edited</i>}
          {fmtTime(m.ts)}
          {mine && !m.deleted && <Ticks s={m.status} receipts={receipts} />}
        </span>
        {!m.deleted && (
          <button
            className="chev"
            aria-label="Message options"
            aria-haspopup="menu"
            onClick={() => setOpen(true)}
          >
            <ChevronDown size={18} />
          </button>
        )}
        {m.reaction && (
          <button
            className="reaction"
            aria-label={`Reaction ${m.reaction}, tap to remove`}
            onClick={() => act.react(m.id, m.reaction)}
          >
            {m.reaction}
          </button>
        )}
        {open && (
          <>
            <div className="scrim" onClick={close} />
            <div className={`menu msgmenu ${mine ? 'r' : 'l'}`} role="menu">
              <div className="reacts">
                {REACTS.map((e) => (
                  <button
                    key={e}
                    aria-label={`React ${e}`}
                    onClick={() => {
                      act.react(m.id, e);
                      close();
                    }}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <button
                role="menuitem"
                onClick={() => {
                  act.reply(m);
                  close();
                }}
              >
                <Reply size={15} /> Reply
              </button>
              {m.type === 'text' && (
                <button
                  role="menuitem"
                  onClick={() => {
                    navigator.clipboard?.writeText(m.text);
                    act.toast('Copied');
                    close();
                  }}
                >
                  <Copy size={15} /> Copy
                </button>
              )}
              {mine && m.type === 'text' && (
                <button
                  role="menuitem"
                  onClick={() => {
                    act.edit(m);
                    close();
                  }}
                >
                  <Pencil size={15} /> Edit
                </button>
              )}
              <button
                role="menuitem"
                onClick={() => {
                  act.remove(m.id, false);
                  close();
                }}
              >
                <Trash2 size={15} /> Delete for me
              </button>
              {mine && (
                <button
                  role="menuitem"
                  onClick={() => {
                    act.remove(m.id, true);
                    close();
                  }}
                >
                  <Trash2 size={15} /> Delete for everyone
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ChatWindow({
  state,
  id,
  msg,
  typing,
  onBack,
  setModal,
  startCall,
  toast
}) {
  const contact = state.contacts.find((c) => c.id === id || c._id === id);
  const chat = state.chats[id] || { messages: [], unread: 0 };
  const st = state.settings;
  const [text, setText] = useState('');
  const [reply, setReply] = useState(null);
  const [editing, setEditing] = useState(null);
  const [emoji, setEmoji] = useState(false);
  const [attach, setAttach] = useState(false);
  const [rec, setRec] = useState(null);
  const [menu, setMenu] = useState(false);
  const [find, setFind] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const endRef = useRef();
  const imgRef = useRef();
  const docRef = useRef();
  const taRef = useRef();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat.messages?.length, typing]);

  useEffect(() => {
    if (!rec) return;
    const t = setInterval(() => setRec((r) => r && { ...r, s: r.s + 1 }), 1000);
    return () => clearInterval(t);
  }, [!rec]);

  useEffect(() => {
    if (chat.unread) msg.open(id);
  }, [chat.unread, id, msg]);

  const handleTextChange = (e) => {
    setText(e.target.value);
    msg.notifyTyping(id);
  };

  const submit = (e) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    if (editing) {
      msg.edit(id, editing, t);
      setEditing(null);
    } else {
      msg.send(id, { type: 'text', text: t, replyTo: reply?.id || null });
      setReply(null);
    }
    msg.stopTyping(id);
    setText('');
    setEmoji(false);
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) submit(e);
    if (e.key === 'Escape') {
      setReply(null);
      setEditing(null);
      setText('');
      msg.stopTyping(id);
    }
  };

  // Real browser microphone audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start();
      setRec({ s: 0 });
    } catch {
      toast('Microphone permission required for voice notes');
      setRec({ s: 0, fake: true });
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    setRec(null);
  };

  const sendVoice = () => {
    const dur = Math.max(1, rec?.s || 1);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          msg.send(id, {
            type: 'voice',
            src: reader.result,
            dur,
            text: ''
          });
        };
        reader.readAsDataURL(audioBlob);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
      };
      mediaRecorderRef.current.stop();
    } else {
      msg.send(id, { type: 'voice', dur, text: '' });
    }
    setRec(null);
  };

  const pickImage = (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    setAttach(false);
    if (!f) return;
    if (!f.type.startsWith('image/')) return toast('Please choose an image file');
    const r = new FileReader();
    r.onload = () => msg.send(id, { type: 'image', src: r.result, text: '' });
    r.onerror = () => toast('Could not read the image');
    r.readAsDataURL(f);
  };

  const pickDoc = (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    setAttach(false);
    if (f) {
      msg.send(id, {
        type: 'doc',
        text: f.name,
        size: `${Math.max(1, Math.round(f.size / 1024))} KB`
      });
    }
  };

  const sendLoc = () => {
    setAttach(false);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          msg.send(id, {
            type: 'location',
            text: `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
          });
        },
        () => {
          msg.send(id, {
            type: 'location',
            text: `${(18.5 + Math.random() * 0.1).toFixed(4)}, ${(73.8 + Math.random() * 0.1).toFixed(4)}`
          });
        }
      );
    } else {
      msg.send(id, {
        type: 'location',
        text: '19.0760, 72.8777'
      });
    }
  };

  const act = {
    toast,
    react: (mid, e) => msg.react(id, mid, e),
    remove: (mid, all) => msg.remove(id, mid, all),
    reply: (m) => {
      setEditing(null);
      setReply(m);
      taRef.current?.focus();
    },
    edit: (m) => {
      setReply(null);
      setEditing(m.id);
      setText(m.text);
      taRef.current?.focus();
    }
  };

  if (!contact) return null;

  const hide = st.lastSeen === 'nobody';
  const status = typing
    ? 'typing…'
    : contact.group
    ? ['You', ...(contact.members || [])].join(', ')
    : hide
    ? ''
    : contact.online
    ? 'online'
    : lastSeenText(contact.lastSeen);

  const shown = find
    ? chat.messages.filter(
        (m) => !m.deleted && m.text?.toLowerCase().includes(find.toLowerCase())
      )
    : chat.messages || [];

  let lastDay = '';

  return (
    <section className="chat" aria-label={`Chat with ${contact.name}`}>
      <header className="bar">
        <button className="icon-btn back-btn" aria-label="Back to chats" onClick={onBack}>
          <ArrowLeft size={22} />
        </button>
        <button
          className="who"
          onClick={() => setModal({ type: 'info', id })}
          aria-label="View contact info"
        >
          <Avatar c={contact} size={40} />
          <div>
            <div className="name">{contact.name}</div>
            <div className={`sub ${typing ? 'g' : ''}`}>{status}</div>
          </div>
        </button>
        <div className="grow" />
        <button
          className="icon-btn"
          aria-label="Search in chat"
          onClick={() => setFind(find === null ? '' : null)}
        >
          <Search size={20} />
        </button>
        {!contact.group && (
          <>
            <button
              className="icon-btn"
              aria-label="Video call"
              onClick={() => startCall(id, 'video')}
            >
              <Video size={22} />
            </button>
            <button
              className="icon-btn"
              aria-label="Voice call"
              onClick={() => startCall(id, 'voice')}
            >
              <Phone size={20} />
            </button>
          </>
        )}
        <div className="menu-wrap">
          <button
            className="icon-btn"
            aria-label="Chat menu"
            aria-haspopup="menu"
            onClick={() => setMenu(!menu)}
          >
            <MoreVertical size={22} />
          </button>
          {menu && (
            <>
              <div className="scrim" onClick={() => setMenu(false)} />
              <div className="menu" role="menu">
                <button
                  role="menuitem"
                  onClick={() => {
                    setModal({ type: 'info', id });
                    setMenu(false);
                  }}
                >
                  <Info size={16} /> Contact info
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    msg.pin(id);
                    setMenu(false);
                    toast(chat.pinned ? 'Chat unpinned' : 'Chat pinned');
                  }}
                >
                  <Pin size={16} /> {chat.pinned ? 'Unpin chat' : 'Pin chat'}
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    msg.fav(id);
                    setMenu(false);
                  }}
                >
                  <Star size={16} /> {contact.fav ? 'Remove favorite' : 'Add to favorites'}
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    msg.clear(id);
                    setMenu(false);
                    toast('Chat cleared');
                  }}
                >
                  <Trash2 size={16} /> Clear chat
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    msg.deleteChat(id);
                    setMenu(false);
                    onBack();
                    toast('Chat deleted');
                  }}
                >
                  <XCircle size={16} /> Delete chat
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    onBack();
                  }}
                >
                  <X size={16} /> Close chat
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {find !== null && (
        <div className="findbar">
          <Search size={16} />
          <input
            autoFocus
            aria-label="Search messages"
            placeholder="Search messages"
            value={find}
            onChange={(e) => setFind(e.target.value)}
          />
          <button
            className="icon-btn sm"
            aria-label="Close search"
            onClick={() => setFind(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div
        className="messages"
        onClick={() => {
          setEmoji(false);
          setAttach(false);
        }}
      >
        {shown.length === 0 && (
          <div className="empty-chat">
            <Avatar c={contact} size={72} />
            <p>No messages yet</p>
            <span>Say hi to {contact.name} 👋</span>
          </div>
        )}
        {find && shown.length === 0 && (
          <div className="empty-chat">
            <Search size={32} />
            <p>No messages match “{find}”</p>
          </div>
        )}
        {shown.map((m) => {
          const d = dayLabel(m.ts);
          const sep = d !== lastDay;
          lastDay = d;
          return (
            <div key={m.id}>
              {sep && (
                <div className="day">
                  <span>{d}</span>
                </div>
              )}
              <Bubble
                m={m}
                chat={chat}
                mine={m.from === 'me'}
                group={contact.group}
                receipts={st.readReceipts}
                act={act}
              />
            </div>
          );
        })}
        {typing && (
          <div className="msg in">
            <div className="bubble typing" aria-label="typing">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {(reply || editing) && (
        <div className="replybar">
          <div className="quote grow">
            <b>
              {editing
                ? 'Editing message'
                : reply.from === 'me'
                ? 'You'
                : reply.sender || contact.name}
            </b>
            <span>
              {editing ? 'Press Enter to save, Esc to cancel' : preview(reply)}
            </span>
          </div>
          <button
            className="icon-btn"
            aria-label="Cancel"
            onClick={() => {
              setReply(null);
              setEditing(null);
              setText('');
            }}
          >
            <X size={20} />
          </button>
        </div>
      )}

      <form className="composer" onSubmit={submit}>
        {rec ? (
          <>
            <button
              type="button"
              className="icon-btn red"
              aria-label="Cancel recording"
              onClick={cancelRecording}
            >
              <Trash2 size={22} />
            </button>
            <div className="recording grow">
              <i className="rec-dot" /> {fmtDur(rec.s)} <span>Recording audio…</span>
            </div>
            <button
              type="button"
              className="send"
              aria-label="Send voice message"
              onClick={sendVoice}
            >
              <Send size={20} />
            </button>
          </>
        ) : (
          <>
            <div className="pop-wrap">
              <button
                type="button"
                className="icon-btn"
                aria-label="Emoji picker"
                aria-expanded={emoji}
                onClick={() => {
                  setEmoji(!emoji);
                  setAttach(false);
                }}
              >
                <Smile size={24} />
              </button>
              {emoji && (
                <div className="popup emojis" role="dialog" aria-label="Emoji picker">
                  {EMOJIS.map((e) => (
                    <button
                      type="button"
                      key={e}
                      onClick={() => {
                        setText((t) => t + e);
                        taRef.current?.focus();
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="pop-wrap">
              <button
                type="button"
                className="icon-btn"
                aria-label="Attach"
                aria-expanded={attach}
                onClick={() => {
                  setAttach(!attach);
                  setEmoji(false);
                }}
              >
                <Paperclip size={22} />
              </button>
              {attach && (
                <div className="popup attach" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => imgRef.current.click()}
                  >
                    <span style={{ background: '#a855f7' }}>
                      <Img size={18} />
                    </span>{' '}
                    Photo
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => docRef.current.click()}
                  >
                    <span style={{ background: '#5157ae' }}>
                      <FileText size={18} />
                    </span>{' '}
                    Document
                  </button>
                  <button type="button" role="menuitem" onClick={sendLoc}>
                    <span style={{ background: '#1fa855' }}>
                      <MapPin size={18} />
                    </span>{' '}
                    Location
                  </button>
                </div>
              )}
              <input
                ref={imgRef}
                type="file"
                accept="image/*"
                hidden
                onChange={pickImage}
              />
              <input ref={docRef} type="file" hidden onChange={pickDoc} />
            </div>
            <textarea
              ref={taRef}
              rows={1}
              className="grow"
              aria-label="Type a message"
              placeholder="Type a message"
              value={text}
              onChange={handleTextChange}
              onKeyDown={onKey}
            />
            {text.trim() ? (
              <button
                type="submit"
                className="send"
                aria-label={editing ? 'Save edit' : 'Send message'}
              >
                {editing ? <Check size={20} /> : <Send size={20} />}
              </button>
            ) : (
              <button
                type="button"
                className="icon-btn"
                aria-label="Record voice message"
                onClick={startRecording}
              >
                <Mic size={24} />
              </button>
            )}
          </>
        )}
      </form>
    </section>
  );
}
