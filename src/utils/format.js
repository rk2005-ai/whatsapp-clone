export const uid = () => Math.random().toString(36).slice(2, 10);
export const fmtTime = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const day0 = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const dayLabel = (t) => {
  const d = new Date(t);
  const diff = Math.round((day0(new Date()) - day0(d)) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};
export const listTime = (t) => { const l = dayLabel(t); return l === 'Today' ? fmtTime(t) : l === 'Yesterday' ? l : new Date(t).toLocaleDateString(); };
export const fmtDur = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
export const lastSeenText = (t) => (t ? `last seen ${dayLabel(t).toLowerCase()} at ${fmtTime(t)}` : 'last seen recently');
export const preview = (m) => {
  if (!m) return 'No messages yet';
  if (m.deleted) return 'This message was deleted';
  if (m.type === 'voice') return '🎤 Voice message ' + fmtDur(m.dur || 1);
  if (m.type === 'image') return '📷 Photo';
  if (m.type === 'doc') return '📄 ' + m.text;
  if (m.type === 'location') return '📍 Location';
  return m.text;
};
