export const KEY = 'wa_clone_state_v1';
export const readStore = () => { try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; } };
export const writeStore = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { console.error('LocalStorage write failed', e); } };
export const clearStore = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };
