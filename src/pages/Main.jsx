import { useEffect, useRef, useState, useCallback } from 'react';
import Sidebar from '../components/Sidebar.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import Settings from '../components/Settings.jsx';
import {
  NewChat,
  ContactInfo,
  StoryViewer,
  AddStatus,
  CallScreen,
  IncomingCallModal
} from '../components/Modals.jsx';
import useMessaging from '../hooks/useMessaging.js';
import { MessageCircle, Lock } from 'lucide-react';
import { api } from '../api/client.js';
import { subscribeSocket, sendCallReject } from '../api/socket.js';
import { uid } from '../utils/format.js';

export default function Main({ state, dispatch, onLogout, onReset }) {
  const [activeId, setActive] = useState(null);
  const [tab, setTab] = useState('chats');
  const [panel, setPanel] = useState(null);
  const [modal, setModal] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [typing, setTyping] = useState({});
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const activeRef = useRef(null);
  const msg = useMessaging(dispatch, activeRef, setTyping);

  const showToast = (m) => {
    setToast(m);
    setTimeout(() => setToast(''), 2400);
  };

  // Sync conversations from backend API
  const refreshConversations = useCallback(async () => {
    try {
      const convs = await api.getConversations();
      const myId = String(state.user?._id || state.user?.id);

      const contactsMap = new Map();
      const newChats = { ...state.chats };

      for (const conv of convs) {
        const convId = String(conv._id);
        let contact;

        if (conv.isGroup) {
          contact = {
            id: convId,
            _id: convId,
            name: conv.name || 'Group Chat',
            about: `${conv.participants.length} participants`,
            group: true,
            members: conv.participants.map((p) => p.name || p.phone),
            avatar: ''
          };
        } else {
          const other =
            conv.participants.find((p) => String(p?._id || p) !== myId) || conv.participants[0];
          const otherUserId = String(other?._id || other?.id || other || '');
          contact = {
            id: convId,
            _id: convId,
            userId: otherUserId,
            name: other?.name || other?.phone || 'Contact',
            phone: other?.phone || '',
            about: other?.about || 'Hey there! I am using WhatsApp.',
            avatar: other?.avatar || '',
            online: !!other?.isOnline,
            lastSeen: other?.lastSeen ? new Date(other.lastSeen).getTime() : Date.now()
          };
        }

        contactsMap.set(convId, contact);

        if (!newChats[convId]) {
          newChats[convId] = {
            pinned: false,
            unread: 0,
            messages: conv.lastMessage
              ? [
                  {
                    id: String(conv.lastMessage._id),
                    from:
                      String(conv.lastMessage.sender?._id || conv.lastMessage.sender) === myId
                        ? 'me'
                        : convId,
                    sender: conv.lastMessage.sender?.name,
                    text: conv.lastMessage.text || '',
                    type: conv.lastMessage.type || 'text',
                    src: conv.lastMessage.attachmentUrl || '',
                    ts: new Date(conv.lastMessage.createdAt).getTime(),
                    status: 'delivered'
                  }
                ]
              : []
          };
        }
      }

      dispatch((s) => ({
        ...s,
        contacts: Array.from(contactsMap.values()),
        chats: newChats
      }));

      try {
        const statusRes = await api.getStatuses();
        if (statusRes) {
          dispatch((s) => ({
            ...s,
            myStatus: statusRes.myStatus || [],
            statuses: statusRes.statuses || []
          }));
        }
      } catch (e) {
        console.warn('Could not load statuses:', e);
      }
    } catch (err) {
      console.warn('Could not refresh conversations from API:', err.message);
    } finally {
      setLoading(false);
    }
  }, [state.user, dispatch]);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // Listen for real-time incoming WebRTC calls via Socket
  useEffect(() => {
    const unsub = subscribeSocket('call:incoming', (callData) => {
      const myId = String(state.user?._id || state.user?.id);
      const callerId = String(callData.fromUser?._id || callData.fromUser?.id);

      // Ignore incoming call from oneself
      if (!callerId || callerId === myId) return;

      // If already in an active call, reject as busy
      if (modal?.type === 'call') {
        sendCallReject({ toUserId: callerId, callId: callData.callId });
        return;
      }

      setIncomingCall(callData);
    });

    return unsub;
  }, [modal, state.user]);

  // Listen for real-time status updates via Socket
  useEffect(() => {
    const unsub = subscribeSocket('status:new', (data) => {
      const myId = String(state.user?._id || state.user?.id);
      const isMine = String(data.userId) === myId;
      dispatch((s) => {
        if (isMine) {
          return {
            ...s,
            myStatus: [...s.myStatus, data.item]
          };
        }
        const existingIdx = s.statuses.findIndex(
          (st) => st.id === data.userId || st.contactId === data.userId
        );
        let updatedStatuses;
        if (existingIdx >= 0) {
          updatedStatuses = [...s.statuses];
          const curr = updatedStatuses[existingIdx];
          updatedStatuses[existingIdx] = {
            ...curr,
            items: [...curr.items, data.item],
            viewed: false
          };
        } else {
          updatedStatuses = [
            {
              id: data.userId,
              contactId: data.userId,
              name: data.user?.name || 'Contact',
              avatar: data.user?.avatar || '',
              viewed: false,
              items: [data.item]
            },
            ...s.statuses
          ];
        }
        return { ...s, statuses: updatedStatuses };
      });
    });
    return unsub;
  }, [state.user, dispatch]);

  const openChat = async (id) => {
    activeRef.current = id;
    setActive(id);
    setModal(null);
    setTab('chats');
    msg.open(id);

    try {
      const messages = await api.getMessages(id);
      const myId = String(state.user?._id || state.user?.id);

      const formatted = messages.map((m) => ({
        id: String(m._id || m.id),
        _id: m._id,
        from: String(m.sender?._id || m.sender) === myId ? 'me' : id,
        sender: m.sender?.name,
        text: m.text || '',
        type: m.type || 'text',
        src: m.attachmentUrl || '',
        size: m.size || '',
        dur: m.dur || 1,
        ts: new Date(m.createdAt).getTime(),
        status: 'delivered',
        reaction: null,
        replyTo: m.replyTo || null,
        deleted: m.deletedForEveryone || false,
        edited: !!m.editedAt
      }));

      dispatch((s) => {
        const c = s.chats[id] || { pinned: false, unread: 0 };
        return {
          ...s,
          chats: {
            ...s.chats,
            [id]: { ...c, unread: 0, messages: formatted }
          }
        };
      });
    } catch (err) {
      console.warn('Could not load message history:', err);
    }
  };

  const closeChat = () => {
    activeRef.current = null;
    setActive(null);
  };

  const get = (id) =>
    state.contacts.find((c) => c.id === id || c._id === id || c.userId === id);

  const startCall = (contactId, type) => {
    const contact = get(contactId);
    const myId = String(state.user?._id || state.user?.id);
    let targetUserId = contact?.userId;
    if (!targetUserId && contact?._id && String(contact._id) !== myId) {
      targetUserId = String(contact._id);
    }
    if (!targetUserId && contactId && String(contactId) !== myId) {
      targetUserId = String(contactId);
    }
    const callId = uid();

    setModal({
      type: 'call',
      contactId,
      callType: type,
      role: 'caller',
      targetUserId,
      callId,
      contact: contact || { name: 'Contact' }
    });
  };

  const handleAcceptCall = () => {
    if (!incomingCall) return;
    const { fromUser, type, callId } = incomingCall;
    setIncomingCall(null);
    const targetUserId = String(fromUser._id || fromUser.id);

    setModal({
      type: 'call',
      contactId: targetUserId,
      callType: type,
      role: 'receiver',
      targetUserId,
      callId,
      contact: fromUser
    });
  };

  const handleRejectCall = () => {
    if (!incomingCall) return;
    sendCallReject({
      toUserId: incomingCall.fromUser?._id,
      callId: incomingCall.callId
    });

    dispatch((s) => ({
      ...s,
      calls: [
        {
          id: Math.random().toString(36).slice(2),
          contactId: incomingCall.fromUser?._id,
          type: incomingCall.type,
          dir: 'in',
          missed: true,
          ts: Date.now(),
          dur: 0
        },
        ...s.calls
      ]
    }));

    setIncomingCall(null);
    showToast('Call declined');
  };

  const endCall = (contactId, callType, dur, connected) => {
    dispatch((s) => ({
      ...s,
      calls: [
        {
          id: Math.random().toString(36).slice(2),
          contactId,
          type: callType,
          dir: modal?.role === 'receiver' ? 'in' : 'out',
          missed: !connected,
          ts: Date.now(),
          dur
        },
        ...s.calls
      ]
    }));
    setModal(null);
    showToast(connected ? 'Call ended' : 'Call ended');
  };

  const seen = (id) => {
    dispatch((s) => ({
      ...s,
      statuses: s.statuses.map((x) =>
        x.id === id || x.contactId === id ? { ...x, viewed: true } : x
      )
    }));
    api.viewStatus(id).catch(() => {});
  };

  return (
    <div className={`app wp-${state.settings.wallpaper} ${activeId ? 'show-chat' : ''}`}>
      <aside className="sidebar">
        {panel === 'settings' ? (
          <Settings
            state={state}
            dispatch={dispatch}
            onClose={() => setPanel(null)}
            onLogout={onLogout}
            onReset={onReset}
            toast={showToast}
          />
        ) : (
          <Sidebar
            {...{
              state,
              dispatch,
              tab,
              setTab,
              activeId,
              openChat,
              setPanel,
              setModal,
              loading,
              typing,
              onLogout,
              startCall
            }}
          />
        )}
      </aside>

      <main className="chatpane">
        {activeId && get(activeId) ? (
          <ChatWindow
            key={activeId}
            {...{
              state,
              dispatch,
              id: activeId,
              msg,
              typing: !!typing[activeId],
              onBack: closeChat,
              setModal,
              startCall,
              toast: showToast
            }}
          />
        ) : (
          <div className="welcome">
            <div className="welcome-icon">
              <MessageCircle size={64} />
            </div>
            <h2>WhatsApp Web</h2>
            <p>Select a chat or start a new conversation to begin real-time messaging.</p>
            <span className="welcome-foot">
              <Lock size={13} /> Connected to live API and WebSockets
            </span>
          </div>
        )}
      </main>

      {/* Incoming Call Notification Banner */}
      {incomingCall && (
        <IncomingCallModal
          call={incomingCall}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}

      {modal?.type === 'new' && (
        <NewChat
          state={state}
          dispatch={dispatch}
          onClose={() => setModal(null)}
          onOpen={openChat}
          onRefresh={refreshConversations}
          toast={showToast}
        />
      )}
      {modal?.type === 'info' && get(modal.id) && (
        <ContactInfo
          contact={get(modal.id)}
          chat={state.chats[modal.id]}
          onClose={() => setModal(null)}
          onFav={() => msg.fav(modal.id)}
          onCall={startCall}
        />
      )}
      {modal?.type === 'story' && (
        <StoryViewer
          key={modal.id}
          state={state}
          id={modal.id}
          onClose={() => setModal(null)}
          onSeen={seen}
        />
      )}
      {modal?.type === 'addStatus' && (
        <AddStatus
          onClose={() => setModal(null)}
          onAdd={async (it) => {
            try {
              await api.createStatus(it);
              setModal(null);
              showToast('Status posted');
            } catch (err) {
              showToast(err.message || 'Failed to post status');
            }
          }}
        />
      )}
      {modal?.type === 'call' && (
        <CallScreen
          contact={modal.contact || get(modal.contactId)}
          type={modal.callType}
          role={modal.role || 'caller'}
          targetUserId={modal.targetUserId}
          callId={modal.callId}
          onEnd={endCall}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
