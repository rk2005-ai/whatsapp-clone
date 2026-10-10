import { useEffect, useRef } from 'react';
import { api } from '../api/client.js';
import {
  subscribeSocket,
  joinConversation,
  sendTypingStart,
  sendTypingStop
} from '../api/socket.js';
import { uid } from '../utils/format.js';

export default function useMessaging(dispatch, activeRef, setTyping) {
  const typingTimer = useRef(null);

  // Play incoming message sound
  const playSound = () => {
    try {
      new Audio(
        'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
      ).play().catch(() => {});
    } catch {
      /* ignore */
    }
  };

  // Subscribe to real-time socket events
  useEffect(() => {
    const unsubNew = subscribeSocket('message:new', (msg) => {
      const convId = String(msg.conversation);
      dispatch((s) => {
        const c = s.chats[convId] || { messages: [], unread: 0, pinned: false };
        // Check if message already exists (from optimistic UI)
        const exists = c.messages.some(
          (m) => String(m.id || m._id) === String(msg._id || msg.id)
        );
        const isFromMe = String(msg.sender?._id || msg.sender) === String(s.user?._id || s.user?.id);
        const isCurrentActive = activeRef.current === convId;
        const unread = isFromMe || isCurrentActive ? 0 : (c.unread || 0) + 1;

        if (!isFromMe && s.settings.sounds && !isCurrentActive) {
          playSound();
        }

        const formattedMsg = {
          id: msg._id || msg.id,
          _id: msg._id,
          from: isFromMe ? 'me' : String(msg.sender?._id || msg.sender),
          sender: msg.sender?.name,
          text: msg.text || '',
          type: msg.type || 'text',
          src: msg.attachmentUrl || msg.src || '',
          size: msg.size || '',
          dur: msg.dur || 1,
          ts: new Date(msg.createdAt || Date.now()).getTime(),
          status: 'delivered',
          reaction: null,
          replyTo: msg.replyTo || null,
          deleted: msg.deletedForEveryone || false,
          edited: !!msg.editedAt
        };

        const updatedMessages = exists
          ? c.messages.map((m) =>
              String(m.id || m._id) === String(msg._id || msg.id) ? formattedMsg : m
            )
          : [...c.messages, formattedMsg];

        return {
          ...s,
          chats: {
            ...s.chats,
            [convId]: { ...c, unread, messages: updatedMessages }
          }
        };
      });
    });

    const unsubUpd = subscribeSocket('message:updated', (msg) => {
      const convId = String(msg.conversation);
      dispatch((s) => {
        const c = s.chats[convId];
        if (!c) return s;
        return {
          ...s,
          chats: {
            ...s.chats,
            [convId]: {
              ...c,
              messages: c.messages.map((m) =>
                String(m.id || m._id) === String(msg._id || msg.id)
                  ? { ...m, text: msg.text, edited: true }
                  : m
              )
            }
          }
        };
      });
    });

    const unsubDel = subscribeSocket('message:deleted', ({ id, conversationId }) => {
      dispatch((s) => {
        const c = s.chats[conversationId];
        if (!c) return s;
        return {
          ...s,
          chats: {
            ...s.chats,
            [conversationId]: {
              ...c,
              messages: c.messages.map((m) =>
                String(m.id || m._id) === String(id)
                  ? { ...m, deleted: true, text: '', src: null }
                  : m
              )
            }
          }
        };
      });
    });

    const unsubTyping = subscribeSocket('typing:update', ({ conversationId, userId, typing }) => {
      setTyping((t) => ({ ...t, [conversationId]: typing }));
    });

    return () => {
      unsubNew();
      unsubUpd();
      unsubDel();
      unsubTyping();
    };
  }, [dispatch, activeRef, setTyping]);

  return {
    async send(convId, data) {
      const tempId = 'temp_' + uid();
      const optimisticMsg = {
        id: tempId,
        _id: tempId,
        from: 'me',
        text: data.text || '',
        type: data.type || 'text',
        src: data.src || '',
        size: data.size || '',
        dur: data.dur || 1,
        ts: Date.now(),
        status: 'sent',
        reaction: null,
        replyTo: data.replyTo || null
      };

      // Optimistic update in UI
      dispatch((s) => {
        const c = s.chats[convId] || { messages: [], unread: 0, pinned: false };
        return {
          ...s,
          chats: {
            ...s.chats,
            [convId]: { ...c, messages: [...c.messages, optimisticMsg] }
          }
        };
      });

      sendTypingStop(convId);

      try {
        const realMsg = await api.sendMessage(convId, {
          text: data.text || '',
          type: data.type || 'text',
          attachmentUrl: data.src || '',
          replyTo: data.replyTo || null
        });

        // Replace optimistic message with confirmed server message
        dispatch((s) => {
          const c = s.chats[convId];
          if (!c) return s;
          return {
            ...s,
            chats: {
              ...s.chats,
              [convId]: {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === tempId
                    ? {
                        ...m,
                        id: realMsg._id || realMsg.id,
                        _id: realMsg._id,
                        status: 'delivered',
                        ts: new Date(realMsg.createdAt).getTime()
                      }
                    : m
                )
              }
            }
          };
        });
      } catch (err) {
        console.error('Failed to send message:', err);
      }
    },

    notifyTyping(convId) {
      sendTypingStart(convId);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => {
        sendTypingStop(convId);
      }, 2500);
    },

    stopTyping(convId) {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      sendTypingStop(convId);
    },

    async edit(convId, messageId, newText) {
      // Local optimistic update
      dispatch((s) => {
        const c = s.chats[convId];
        if (!c) return s;
        return {
          ...s,
          chats: {
            ...s.chats,
            [convId]: {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, text: newText, edited: true } : m
              )
            }
          }
        };
      });

      try {
        await api.editMessage(convId, messageId, newText);
      } catch (e) {
        console.error('Failed to edit message:', e);
      }
    },

    async remove(convId, messageId, forAll) {
      dispatch((s) => {
        const c = s.chats[convId];
        if (!c) return s;
        return {
          ...s,
          chats: {
            ...s.chats,
            [convId]: {
              ...c,
              messages: forAll
                ? c.messages.map((m) =>
                    m.id === messageId ? { ...m, deleted: true, text: '', src: null } : m
                  )
                : c.messages.filter((m) => m.id !== messageId)
            }
          }
        };
      });

      if (forAll) {
        try {
          await api.deleteMessage(convId, messageId);
        } catch (e) {
          console.error('Failed to delete message for all:', e);
        }
      }
    },

    react(convId, messageId, emoji) {
      dispatch((s) => {
        const c = s.chats[convId];
        if (!c) return s;
        return {
          ...s,
          chats: {
            ...s.chats,
            [convId]: {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, reaction: m.reaction === emoji ? null : emoji } : m
              )
            }
          }
        };
      });
    },

    open(convId) {
      joinConversation(convId);
      dispatch((s) => {
        const c = s.chats[convId];
        if (!c) return s;
        return { ...s, chats: { ...s.chats, [convId]: { ...c, unread: 0 } } };
      });
    },

    pin(convId) {
      dispatch((s) => {
        const c = s.chats[convId] || { messages: [], unread: 0, pinned: false };
        return { ...s, chats: { ...s.chats, [convId]: { ...c, pinned: !c.pinned } } };
      });
    },

    clear(convId) {
      dispatch((s) => {
        const c = s.chats[convId];
        if (!c) return s;
        return { ...s, chats: { ...s.chats, [convId]: { ...c, messages: [] } } };
      });
    },

    deleteChat(convId) {
      dispatch((s) => {
        const chats = { ...s.chats };
        delete chats[convId];
        return { ...s, chats };
      });
    },

    fav(contactId) {
      dispatch((s) => ({
        ...s,
        contacts: s.contacts.map((c) =>
          c.id === contactId || c._id === contactId ? { ...c, fav: !c.fav } : c
        )
      }));
    }
  };
}
