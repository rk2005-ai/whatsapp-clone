import { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  Search,
  UserPlus,
  Users,
  Star,
  Phone,
  Video,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  Volume2,
  Loader2,
  Check,
  PhoneIncoming
} from 'lucide-react';
import Avatar from './Avatar.jsx';
import { BG } from '../data/mock.js';
import { fmtDur, uid, listTime } from '../utils/format.js';
import { api } from '../api/client.js';
import {
  sendCallInvite,
  sendCallAccept,
  sendCallReject,
  sendCallSignal,
  sendCallEnd,
  subscribeSocket
} from '../api/socket.js';
import { playRingTone, playIncomingRing } from '../utils/audio.js';

const Modal = ({ title, onClose, children }) => (
  <div className="overlay" onClick={onClose}>
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.stopPropagation()}
    >
      <header className="bar">
        <button className="icon-btn" aria-label="Close" onClick={onClose}>
          <X size={22} />
        </button>
        <h3>{title}</h3>
      </header>
      {children}
    </div>
  </div>
);

export function NewChat({ state, dispatch, onClose, onOpen, onRefresh, toast }) {
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('list');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q || q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await api.searchUsers(q);
        setSearchResults(users);
      } catch (err) {
        console.warn('User search failed:', err);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  const startDirectChat = async (user) => {
    setLoading(true);
    try {
      const conv = await api.createConversation({
        participantIds: [user._id || user.id],
        isGroup: false
      });
      if (onRefresh) await onRefresh();
      onOpen(String(conv._id || conv.id));
      onClose();
    } catch (err) {
      toast(err.message || 'Could not start conversation');
    } finally {
      setLoading(false);
    }
  };

  const handleAddByPhone = async (e) => {
    e.preventDefault();
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (name.trim().length < 2) return toast('Enter a valid contact name');
    if (!/^\+?[1-9]\d{7,14}$/.test(cleanPhone)) return toast('Enter a valid phone number');

    setLoading(true);
    try {
      const found = await api.searchUsers(cleanPhone);
      let targetUser = found.find((u) => u.phone === cleanPhone);

      if (!targetUser) {
        const contactId = 'c_' + uid();
        const newContact = {
          id: contactId,
          _id: contactId,
          name: name.trim(),
          phone: cleanPhone,
          about: 'Hey there! I am using WhatsApp.',
          avatar: '',
          online: false
        };
        dispatch((s) => ({
          ...s,
          contacts: [...s.contacts, newContact]
        }));
        onOpen(contactId);
        onClose();
        return;
      }

      const conv = await api.createConversation({
        participantIds: [targetUser._id],
        isGroup: false
      });
      if (onRefresh) await onRefresh();
      onOpen(String(conv._id));
      onClose();
    } catch (err) {
      toast(err.message || 'Error creating chat');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) return toast('Enter a group name');
    if (selectedMembers.length === 0) return toast('Select at least one member');

    setLoading(true);
    try {
      const conv = await api.createConversation({
        name: groupName.trim(),
        isGroup: true,
        participantIds: selectedMembers
      });
      if (onRefresh) await onRefresh();
      onOpen(String(conv._id));
      onClose();
      toast('Group created!');
    } catch (err) {
      toast(err.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const toggleMember = (id) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <Modal
      title={
        mode === 'contact' ? 'New Contact' : mode === 'group' ? 'New Group' : 'New Chat'
      }
      onClose={onClose}
    >
      {mode === 'contact' && (
        <form className="form" onSubmit={handleAddByPhone} noValidate>
          <label>
            Contact Name
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              required
            />
          </label>
          <label>
            Phone Number
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="+91 98765 43210"
              required
            />
          </label>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? <Loader2 size={18} className="spin" /> : 'Save and Chat'}
          </button>
          <button className="link" type="button" onClick={() => setMode('list')}>
            Back to contacts
          </button>
        </form>
      )}

      {mode === 'group' && (
        <form className="form" onSubmit={handleCreateGroup} noValidate>
          <label>
            Group Subject
            <input
              autoFocus
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Project Team"
              required
            />
          </label>
          <div className="section">Select Members ({selectedMembers.length} selected)</div>
          <div className="list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {state.contacts
              .filter((c) => !c.group)
              .map((c) => {
                const memberId = c.userId || c._id || c.id;
                const isSelected = selectedMembers.includes(memberId);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`row ${isSelected ? 'sel' : ''}`}
                    onClick={() => toggleMember(memberId)}
                  >
                    <Avatar c={c} size={40} />
                    <div className="grow">
                      <div className="name">{c.name}</div>
                      <div className="sub">{c.phone || c.about}</div>
                    </div>
                    {isSelected && <Check size={18} className="g" />}
                  </button>
                );
              })}
          </div>
          <button className="btn" type="submit" disabled={loading || !selectedMembers.length}>
            {loading ? <Loader2 size={18} className="spin" /> : 'Create Group'}
          </button>
          <button className="link" type="button" onClick={() => setMode('list')}>
            Back
          </button>
        </form>
      )}

      {mode === 'list' && (
        <>
          <div className="search">
            <Search size={16} />
            <input
              autoFocus
              aria-label="Search users on WhatsApp"
              placeholder="Search user by name or phone"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {searching && <Loader2 size={16} className="spin" />}
          </div>

          <div className="list">
            <button className="row" onClick={() => setMode('group')}>
              <span className="circle">
                <Users size={22} />
              </span>
              <div className="name">New group</div>
            </button>

            <button className="row" onClick={() => setMode('contact')}>
              <span className="circle">
                <UserPlus size={22} />
              </span>
              <div className="name">New contact by phone</div>
            </button>

            {q.trim().length >= 2 && (
              <>
                <div className="section">Search Results on WhatsApp</div>
                {searchResults.length === 0 && !searching && (
                  <div className="empty" style={{ padding: '20px' }}>
                    <p>No registered users found for “{q}”</p>
                    <button
                      className="link"
                      onClick={() => {
                        setMode('contact');
                        if (/^\+?\d+$/.test(q.trim())) setPhone(q.trim());
                        else setName(q.trim());
                      }}
                    >
                      Add “{q}” as a new contact
                    </button>
                  </div>
                )}
                {searchResults.map((u) => (
                  <button
                    className="row"
                    key={u._id}
                    onClick={() => startDirectChat(u)}
                    disabled={loading}
                  >
                    <Avatar c={u} size={49} />
                    <div className="grow">
                      <div className="name">{u.name}</div>
                      <div className="sub">{u.phone || u.about}</div>
                    </div>
                  </button>
                ))}
              </>
            )}

            <div className="section">Your Contacts</div>
            {state.contacts.length === 0 ? (
              <div className="empty" style={{ padding: '24px' }}>
                <Search size={32} />
                <p>No contacts yet</p>
                <span>Search registered users above or add a contact by phone number.</span>
              </div>
            ) : (
              state.contacts.map((c) => (
                <button
                  className="row"
                  key={c.id}
                  onClick={() => {
                    onOpen(c.id);
                    onClose();
                  }}
                >
                  <Avatar c={c} size={49} />
                  <div className="grow">
                    <div className="name">{c.name}</div>
                    <div className="sub">{c.about || c.phone}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

export function ContactInfo({ contact: c, chat, onClose, onFav, onCall }) {
  const media = (chat?.messages || []).filter((m) => m.type === 'image' && !m.deleted);
  return (
    <Modal title={c.group ? 'Group info' : 'Contact info'} onClose={onClose}>
      <div className="info">
        <Avatar c={c} size={140} />
        <h2>{c.name}</h2>
        {!c.group && <p className="sub">{c.phone}</p>}
        {!c.group && (
          <div className="info-actions">
            <button onClick={() => onCall(c.id, 'voice')}>
              <Phone size={20} />
              Voice
            </button>
            <button onClick={() => onCall(c.id, 'video')}>
              <Video size={20} />
              Video
            </button>
          </div>
        )}
        <div className="card">
          <small>About</small>
          <p>{c.about || 'Available'}</p>
        </div>
        {c.group && (
          <div className="card">
            <small>{c.members?.length || 0} members</small>
            {(c.members || []).map((m) => (
              <p key={m}>{m}</p>
            ))}
          </div>
        )}
        <div className="card">
          <small>Media</small>
          {media.length ? (
            <div className="media-grid">
              {media.map((m) => (
                <img key={m.id} src={m.src} alt="Shared media" />
              ))}
            </div>
          ) : (
            <p className="sub">No media shared yet</p>
          )}
        </div>
        <button className="card clickable" onClick={onFav}>
          <Star size={18} className={c.fav ? 'gold' : ''} />{' '}
          {c.fav ? 'Remove from favorites' : 'Add to favorites'}
        </button>
      </div>
    </Modal>
  );
}

export function StoryViewer({ state, id, onClose, onSeen }) {
  const mine = id === 'me';
  const st = mine
    ? { items: state.myStatus }
    : state.statuses.find((s) => s.id === id || s.contactId === id);
  const owner = mine
    ? state.user
    : state.contacts.find((c) => c.id === st?.contactId || c.userId === st?.contactId || c._id === st?.contactId) || st;
  const [i, setI] = useState(0);
  const [p, setP] = useState(0);

  useEffect(() => {
    if (!mine) onSeen(id);
  }, [mine, id, onSeen]);

  useEffect(() => {
    setP(0);
    const t = setInterval(() => setP((x) => x + 1.25), 50);
    return () => clearInterval(t);
  }, [i]);

  useEffect(() => {
    if (p >= 100) {
      if (st && i < st.items.length - 1) setI(i + 1);
      else onClose();
    }
  }, [p, i, st, onClose]);

  useEffect(() => {
    const k = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  if (!st || !st.items?.length) return null;
  const it = st.items[i];
  const go = (d) => {
    const n = i + d;
    if (n < 0) setP(0);
    else if (n >= st.items.length) onClose();
    else setI(n);
  };

  return (
    <div
      className="story"
      style={{ background: it.bg || '#111b21' }}
      role="dialog"
      aria-label="Status viewer"
    >
      <div className="bars">
        {st.items.map((_, k) => (
          <i key={k}>
            <b
              style={{
                width: k < i ? '100%' : k === i ? `${Math.min(p, 100)}%` : 0
              }}
            />
          </i>
        ))}
      </div>
      <header>
        <Avatar c={owner} size={40} />
        <div>
          <div className="name">{mine ? 'My status' : owner?.name}</div>
          <small>{listTime(it.ts)}</small>
        </div>
        <div className="grow" />
        <button className="icon-btn" aria-label="Close status" onClick={onClose}>
          <X size={24} />
        </button>
      </header>
      {it.image ? (
        <img
          src={it.image}
          alt="Status"
          style={{
            maxWidth: '100%',
            maxHeight: '75vh',
            objectFit: 'contain',
            margin: 'auto',
            display: 'block'
          }}
        />
      ) : (
        <div className="story-text">{it.text}</div>
      )}
      <button className="tap l" aria-label="Previous status" onClick={() => go(-1)} />
      <button className="tap r" aria-label="Next status" onClick={() => go(1)} />
    </div>
  );
}

export function AddStatus({ onClose, onAdd }) {
  const [t, setT] = useState('');
  const [bg, setBg] = useState(BG[0]);
  const [img, setImg] = useState('');
  const fileRef = useRef(null);

  const post = (e) => {
    e.preventDefault();
    if (!t.trim() && !img) return;
    onAdd({
      id: uid(),
      text: t.trim(),
      image: img,
      bg: img ? '#000000' : bg,
      ts: Date.now()
    });
  };

  const handlePickImg = (e) => {
    const file = e.target.files[0];
    if (file) {
      const r = new FileReader();
      r.onload = () => setImg(r.result);
      r.readAsDataURL(file);
    }
  };

  return (
    <div
      className="story"
      style={{ background: img ? '#0b141a' : bg }}
      role="dialog"
      aria-label="Add status"
    >
      <header>
        <button className="icon-btn" aria-label="Close" onClick={onClose}>
          <X size={24} />
        </button>
        <div className="grow" />
        {!img && (
          <div className="swatches">
            {BG.map((c) => (
              <button
                key={c}
                aria-label={`Background ${c}`}
                className={bg === c ? 'on' : ''}
                style={{ background: c }}
                onClick={() => setBg(c)}
              />
            ))}
          </div>
        )}
      </header>
      <form className="story-form" onSubmit={post}>
        {img ? (
          <div style={{ textAlign: 'center', margin: 'auto' }}>
            <img
              src={img}
              alt="Preview"
              style={{ maxHeight: '55vh', maxWidth: '90%', borderRadius: '12px' }}
            />
            <button
              type="button"
              className="link"
              style={{ color: '#fff', display: 'block', margin: '8px auto' }}
              onClick={() => setImg('')}
            >
              Remove photo
            </button>
          </div>
        ) : (
          <textarea
            autoFocus
            aria-label="Status text"
            placeholder="Type a status update…"
            maxLength={140}
            value={t}
            onChange={(e) => setT(e.target.value)}
          />
        )}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            className="icon-btn"
            style={{ color: '#fff' }}
            title="Upload photo status"
            onClick={() => fileRef.current?.click()}
          >
            📷
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handlePickImg}
          />
          <button
            className="send"
            disabled={!t.trim() && !img}
            aria-label="Post status"
          >
            Post
          </button>
        </div>
      </form>
    </div>
  );
}

const RTC_CONFIG = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    },
    {
      urls: 'turns:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ],
  iceCandidatePoolSize: 10
};

export function CallScreen({
  contact,
  type = 'video',
  role = 'caller', // 'caller' | 'receiver'
  targetUserId,
  callId = uid(),
  onEnd
}) {
  const [phase, setPhase] = useState(role === 'caller' ? 'ringing' : 'connecting');
  const [sec, setSec] = useState(0);
  const [mute, setMute] = useState(false);
  const [cam, setCam] = useState(type === 'video');
  const [facing, setFacing] = useState('user');
  const [spk, setSpk] = useState(true);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [statusMsg, setStatusMsg] = useState(
    role === 'caller' ? 'Calling…' : 'Connecting call…'
  );

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pcRef = useRef(null);
  const isEndingRef = useRef(false);
  const pendingCandidatesRef = useRef([]);

  // Mutable refs to prevent stale closures
  const secRef = useRef(0);
  secRef.current = sec;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;
  const contactRef = useRef(contact);
  contactRef.current = contact;
  const targetUserIdRef = useRef(targetUserId);
  targetUserIdRef.current = targetUserId;

  // Play outgoing ringtone when in ringing phase
  useEffect(() => {
    if (phase === 'ringing') {
      const stopRing = playRingTone();
      return stopRing;
    }
  }, [phase]);

  // Unlock audio if browser autoplay was blocked
  const unlockAudio = useCallback(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current
        .play()
        .then(() => setAudioBlocked(false))
        .catch(() => {});
    }
  }, []);

  // Listen for user touch/click to unlock audio if blocked
  useEffect(() => {
    if (!audioBlocked) return;
    const handleInteract = () => unlockAudio();
    window.addEventListener('click', handleInteract, { once: true });
    window.addEventListener('touchstart', handleInteract, { once: true });
    return () => {
      window.removeEventListener('click', handleInteract);
      window.removeEventListener('touchstart', handleInteract);
    };
  }, [audioBlocked, unlockAudio]);

  // Ensure remote stream is properly attached to media elements
  const attachRemoteStream = useCallback((stream) => {
    if (!stream) return;
    remoteStreamRef.current = stream;

    // Attach to video element (MUTED so browser NEVER blocks video autoplay)
    if (remoteVideoRef.current) {
      if (remoteVideoRef.current.srcObject !== stream) {
        remoteVideoRef.current.srcObject = stream;
      }
      remoteVideoRef.current.play().catch((err) => {
        console.warn('[WebRTC] Video autoPlay note:', err);
      });
    }

    // Attach to audio element (handles sound)
    if (remoteAudioRef.current) {
      if (remoteAudioRef.current.srcObject !== stream) {
        remoteAudioRef.current.srcObject = stream;
      }
      remoteAudioRef.current.volume = 1.0;
      const p = remoteAudioRef.current.play();
      if (p !== undefined) {
        p.then(() => setAudioBlocked(false)).catch((err) => {
          console.warn('[WebRTC] Audio autoPlay blocked by policy:', err);
          setAudioBlocked(true);
        });
      }
    }

    setPhase('live');
    setStatusMsg('');
  }, []);

  // Sync remote stream if phase changes
  useEffect(() => {
    if (remoteStreamRef.current) {
      attachRemoteStream(remoteStreamRef.current);
    }
  }, [phase, attachRemoteStream]);

  // Stable finishCall handler
  const finishCall = useCallback(
    (connected = false) => {
      if (isEndingRef.current) return;
      isEndingRef.current = true;

      if (targetUserIdRef.current) {
        sendCallEnd({ toUserId: targetUserIdRef.current, callId });
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch {}
      }

      const c = contactRef.current;
      onEndRef.current?.(
        c?.id || c?._id,
        type,
        secRef.current,
        connected || phaseRef.current === 'live'
      );
    },
    [callId, type]
  );

  // Initialize WebRTC Peer Connection and Local Media Stream ONCE
  useEffect(() => {
    let unmounted = false;

    async function setupMediaAndPeer() {
      try {
        const audioConstraints = {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        };

        let stream;
        if (type === 'voice') {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints,
            video: false
          });
        } else {
          // Video: try front camera with ideal dimensions, fallback gracefully
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: audioConstraints,
              video: {
                facingMode: 'user',
                width: { ideal: 1280, max: 1920 },
                height: { ideal: 720, max: 1080 }
              }
            });
          } catch {
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                audio: audioConstraints,
                video: true
              });
            } catch {
              stream = await navigator.mediaDevices.getUserMedia({
                audio: audioConstraints,
                video: false
              });
            }
          }
        }

        if (unmounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
          localVideoRef.current.play().catch(() => {});
        }

        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // When remote stream tracks arrive
        pc.ontrack = (event) => {
          console.log('[WebRTC] ontrack kind:', event.track.kind);
          let remStream = event.streams && event.streams[0];
          if (!remStream) {
            if (!remoteStreamRef.current) {
              remoteStreamRef.current = new MediaStream();
            }
            remoteStreamRef.current.addTrack(event.track);
            remStream = remoteStreamRef.current;
          }
          attachRemoteStream(remStream);

          event.track.onunmute = () => {
            attachRemoteStream(remStream);
          };
        };

        // Forward local ICE candidates to remote peer
        pc.onicecandidate = (event) => {
          if (event.candidate && targetUserId) {
            sendCallSignal({
              toUserId: targetUserId,
              callId,
              signal: { type: 'candidate', candidate: event.candidate }
            });
          }
        };

        pc.onconnectionstatechange = () => {
          console.log('[WebRTC] ConnectionState:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            setPhase('live');
            setStatusMsg('');
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log('[WebRTC] IceConnectionState:', pc.iceConnectionState);
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            setPhase('live');
            setStatusMsg('');
          }
        };

        // Signaling role initialization
        if (role === 'receiver' && targetUserId) {
          sendCallAccept({ toUserId: targetUserId, callId });
          setStatusMsg('Connecting…');
        } else if (role === 'caller' && targetUserId) {
          sendCallInvite({
            toUserId: targetUserId,
            type,
            callId
          });
        } else {
          // Self-preview test mode
          setStatusMsg(type === 'video' ? 'Camera active' : 'Microphone active');
          setTimeout(() => setPhase('live'), 800);
        }
      } catch (err) {
        console.warn('[WebRTC] Media access warning:', err.message);
        setStatusMsg('Microphone or Camera access required');
        setTimeout(() => setPhase('live'), 1000);
      }
    }

    setupMediaAndPeer();

    return () => {
      unmounted = true;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (pcRef.current) {
        try {
          pcRef.current.close();
        } catch {}
      }
    };
  }, [type, role, targetUserId, callId, attachRemoteStream]);

  // Handle incoming signaling events from remote peer
  useEffect(() => {
    const unsubAccept = subscribeSocket('call:accepted', async (data) => {
      if (data.callId && data.callId !== callId) return;
      setPhase('connecting');
      setStatusMsg('Establishing live stream…');

      const pc = pcRef.current;
      if (pc && targetUserId) {
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: type === 'video'
          });
          await pc.setLocalDescription(offer);
          sendCallSignal({
            toUserId: targetUserId,
            callId,
            signal: { type: 'offer', sdp: offer.sdp }
          });
        } catch (e) {
          console.error('[WebRTC] Failed to create offer:', e);
        }
      }
    });

    const unsubSignal = subscribeSocket('call:signal', async ({ signal, fromUserId, callId: cid }) => {
      if (cid && cid !== callId) return;
      const pc = pcRef.current;
      if (!pc || !signal) return;

      try {
        if (signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: signal.sdp }));

          // Drain buffered candidates
          while (pendingCandidatesRef.current.length > 0) {
            const cand = pendingCandidatesRef.current.shift();
            try {
              if (cand && (cand.candidate || cand.candidate === '')) {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              }
            } catch (e) {
              console.warn('[WebRTC] Candidate drain warning:', e);
            }
          }

          const answer = await pc.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: type === 'video'
          });
          await pc.setLocalDescription(answer);
          sendCallSignal({
            toUserId: fromUserId || targetUserId,
            callId,
            signal: { type: 'answer', sdp: answer.sdp }
          });
        } else if (signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: signal.sdp }));

          // Drain buffered candidates
          while (pendingCandidatesRef.current.length > 0) {
            const cand = pendingCandidatesRef.current.shift();
            try {
              if (cand && (cand.candidate || cand.candidate === '')) {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              }
            } catch (e) {
              console.warn('[WebRTC] Candidate drain warning:', e);
            }
          }
        } else if (signal.type === 'candidate' && signal.candidate) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            try {
              if (signal.candidate.candidate || signal.candidate.candidate === '') {
                await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
              }
            } catch (e) {
              console.warn('[WebRTC] Add candidate warning:', e);
            }
          } else {
            pendingCandidatesRef.current.push(signal.candidate);
          }
        }
      } catch (err) {
        console.error('[WebRTC] Signaling error:', err);
      }
    });

    const unsubReject = subscribeSocket('call:rejected', (data) => {
      if (data.callId && data.callId !== callId) return;
      setStatusMsg('Call Declined');
      setTimeout(() => finishCall(false), 1200);
    });

    const unsubEnd = subscribeSocket('call:ended', (data) => {
      if (data.callId && data.callId !== callId) return;
      setStatusMsg('Call Ended');
      setTimeout(() => finishCall(true), 1000);
    });

    return () => {
      unsubAccept();
      unsubSignal();
      unsubReject();
      unsubEnd();
    };
  }, [callId, targetUserId, type, finishCall]);

  // Duration timer for live calls
  useEffect(() => {
    if (phase !== 'live') return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Mute / Unmute microphone
  const toggleMute = () => {
    const nextMute = !mute;
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMute;
      });
    }
    setMute(nextMute);
  };

  // Toggle local video camera
  const toggleCam = () => {
    const nextCam = !cam;
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = nextCam;
      });
    }
    setCam(nextCam);
  };

  // Switch between front and back camera on mobile without interrupting mic
  const switchCamera = async () => {
    if (!localStreamRef.current || type !== 'video') return;
    const nextFacing = facing === 'user' ? 'environment' : 'user';
    try {
      let newStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: nextFacing } }
        });
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextFacing }
        });
      }

      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (oldVideoTrack) {
        oldVideoTrack.stop();
        localStreamRef.current.removeTrack(oldVideoTrack);
      }
      if (newVideoTrack) {
        localStreamRef.current.addTrack(newVideoTrack);
      }

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }

      if (pcRef.current && newVideoTrack) {
        const sender = pcRef.current.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      setFacing(nextFacing);
    } catch (err) {
      console.warn('[WebRTC] Camera switch error:', err);
    }
  };

  const toggleSpeaker = () => {
    const nextSpk = !spk;
    setSpk(nextSpk);
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = nextSpk ? 1.0 : 0.6;
    }
  };

  return (
    <div className={`call ${type}`} role="dialog" aria-label={`Call with ${contact?.name || 'Contact'}`}>
      {/* Remote Full Screen Video Element - Muted so browser NEVER blocks autoplay */}
      <video
        ref={remoteVideoRef}
        autoPlay
        playsInline
        webkit-playsinline="true"
        muted
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 1,
          opacity: type === 'video' && phase === 'live' ? 1 : 0,
          pointerEvents: type === 'video' && phase === 'live' ? 'auto' : 'none',
          background: '#0b141a',
          transition: 'opacity 0.3s ease'
        }}
      />

      {/* Audio element for remote voice stream - Unmuted with full volume */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Tap to Unmute Banner if Browser Autoplay Policy Blocked Audio */}
      {audioBlocked && (
        <button
          type="button"
          onClick={unlockAudio}
          style={{
            position: 'absolute',
            top: '130px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
            background: '#00a884',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '24px',
            fontWeight: 600,
            fontSize: '14px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'pulse 1.5s infinite'
          }}
        >
          <Volume2 size={18} /> Tap to enable sound 🔊
        </button>
      )}

      {/* Header Info */}
      <div
        className="call-top"
        style={{
          position: 'relative',
          zIndex: 2,
          background: phase === 'live' && type === 'video' ? 'rgba(0,0,0,0.5)' : 'transparent',
          padding: '16px',
          borderRadius: '16px'
        }}
      >
        <Avatar
          c={contact}
          size={type === 'video' && phase === 'live' ? 52 : 120}
        />
        <h2>{contact?.name || 'Contact'}</h2>
        <p style={{ fontWeight: 500, letterSpacing: '0.5px' }}>
          {statusMsg || (phase === 'live' ? fmtDur(sec) : 'Connecting…')}
        </p>
      </div>

      {/* Floating Picture-in-Picture Local Camera View */}
      {type === 'video' && (
        <div
          className="self-view"
          style={{
            zIndex: 3,
            overflow: 'hidden',
            borderRadius: '12px',
            border: '2px solid rgba(255,255,255,0.3)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            background: '#000',
            position: 'absolute',
            top: '80px',
            right: '16px',
            width: '100px',
            height: '145px'
          }}
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            webkit-playsinline="true"
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: cam ? 'block' : 'none'
            }}
          />
          {!cam && (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#aaa',
                fontSize: '12px',
                textAlign: 'center',
                padding: '4px'
              }}
            >
              Camera off
            </div>
          )}
        </div>
      )}

      {/* Interactive Call Controls */}
      <div className="call-ctl" style={{ position: 'relative', zIndex: 4 }}>
        {type === 'video' && (
          <button
            className={!cam ? 'off' : ''}
            aria-label={cam ? 'Turn camera off' : 'Turn camera on'}
            title="Toggle camera"
            onClick={toggleCam}
          >
            {cam ? <Video size={24} /> : <VideoOff size={24} />}
          </button>
        )}
        {type === 'video' && (
          <button
            type="button"
            aria-label="Switch camera"
            title="Switch front/back camera"
            onClick={switchCamera}
          >
            🔄
          </button>
        )}
        <button
          className={spk ? 'on' : ''}
          aria-label="Speaker"
          aria-pressed={spk}
          title="Speaker"
          onClick={toggleSpeaker}
        >
          <Volume2 size={24} />
        </button>
        <button
          className={mute ? 'off' : ''}
          aria-label={mute ? 'Unmute' : 'Mute'}
          title="Mute microphone"
          onClick={toggleMute}
        >
          {mute ? <MicOff size={24} /> : <Mic size={24} />}
        </button>
        <button
          className="hang"
          aria-label="End call"
          title="End call"
          onClick={() => finishCall(phase === 'live')}
        >
          <PhoneOff size={26} />
        </button>
      </div>
    </div>
  );
}

export function IncomingCallModal({ call, onAccept, onReject }) {
  useEffect(() => {
    const stopRing = playIncomingRing();
    return stopRing;
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: 'var(--panel-bg, #1f2c34)',
        color: '#fff',
        padding: '16px 24px',
        borderRadius: '16px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
        border: '1px solid var(--accent, #00a884)',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        minWidth: '320px',
        animation: 'slideDown 0.3s ease-out'
      }}
    >
      <Avatar c={call.fromUser} size={54} ring="ring-new" />
      <div style={{ flex: 1 }}>
        <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
          {call.fromUser?.name || 'Incoming Call'}
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--sub, #8696a0)', marginTop: '4px' }}>
          <PhoneIncoming size={14} className="g" />
          <span>Incoming {call.type === 'video' ? 'Video' : 'Voice'} Call…</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          className="icon-btn red"
          style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#ea4335', color: '#fff' }}
          aria-label="Decline Call"
          onClick={onReject}
        >
          <PhoneOff size={20} />
        </button>
        <button
          className="icon-btn"
          style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#00a884', color: '#fff' }}
          aria-label="Accept Call"
          onClick={onAccept}
        >
          {call.type === 'video' ? <Video size={20} /> : <Phone size={20} />}
        </button>
      </div>
    </div>
  );
}
