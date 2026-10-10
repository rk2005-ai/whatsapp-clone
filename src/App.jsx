import { useEffect, useReducer } from 'react';
import Login from './pages/Login.jsx';
import Main from './pages/Main.jsx';
import { seed } from './data/mock.js';
import { readStore, writeStore, clearStore } from './hooks/useLocalStorage.js';
import { api, getStoredUser, clearStoredAuth, getStoredToken } from './api/client.js';
import { initSocket, disconnectSocket, subscribeSocket } from './api/socket.js';

const init = () => {
  const s = readStore();
  const base = seed();
  const storedUser = getStoredUser();
  if (s && s.settings) {
    return {
      ...base,
      ...s,
      user: storedUser || s.user || null,
      contacts: s.contacts || [],
      chats: s.chats || {},
      statuses: s.statuses || [],
      myStatus: s.myStatus || [],
      calls: s.calls || []
    };
  }
  return { ...base, user: storedUser };
};

export default function App() {
  const [state, dispatch] = useReducer((s, fn) => fn(s), null, init);

  // Sync settings and state to local storage
  useEffect(() => {
    writeStore(state);
  }, [state]);

  // Apply theme
  useEffect(() => {
    const apply = () => {
      const t = state.settings.theme;
      document.documentElement.dataset.theme =
        t === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : t;
    };
    apply();
  }, [state.settings.theme]);

  // Verify backend session on startup
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      api.getMe()
        .then((res) => {
          if (res?.user) {
            dispatch((s) => ({ ...s, user: res.user }));
            initSocket();
          }
        })
        .catch(() => {
          clearStoredAuth();
          dispatch((s) => ({ ...s, user: null }));
          disconnectSocket();
        });
    }
  }, []);

  // Listen for real-time presence updates from server socket
  useEffect(() => {
    if (!state.user) return;
    initSocket();
    const unsub = subscribeSocket('presence:update', ({ userId, isOnline, lastSeen }) => {
      dispatch((s) => ({
        ...s,
        contacts: s.contacts.map((c) =>
          c.id === userId || c._id === userId
            ? { ...c, online: isOnline, lastSeen: lastSeen ? new Date(lastSeen).getTime() : c.lastSeen }
            : c
        )
      }));
    });
    return unsub;
  }, [state.user]);

  const logout = () => {
    clearStoredAuth();
    disconnectSocket();
    dispatch((s) => ({ ...s, user: null }));
  };

  const reset = () => {
    clearStore();
    clearStoredAuth();
    disconnectSocket();
    dispatch(() => seed());
  };

  const handleLogin = (user) => {
    dispatch((s) => ({ ...s, user }));
    initSocket();
  };

  if (!state.user) {
    return <Login onLogin={handleLogin} />;
  }

  return <Main state={state} dispatch={dispatch} onLogout={logout} onReset={reset} />;
}
