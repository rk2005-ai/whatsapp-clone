import { useState } from 'react';
import { ArrowLeft, Pencil, Check, LogOut, Trash2 } from 'lucide-react';
import Avatar from './Avatar.jsx';

const Toggle = ({ label, sub, on, set }) => (
  <div className="setrow"><div className="grow"><div>{label}</div>{sub && <small>{sub}</small>}</div>
    <button role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => set(!on)}><i /></button></div>
);
const WALLS = [['default', 'Doodle'], ['mint', 'Mint'], ['sky', 'Sky'], ['sand', 'Sand'], ['night', 'Night']];

export default function Settings({ state, dispatch, onClose, onLogout, onReset, toast }) {
  const { user, settings: st } = state;
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ name: user.name, about: user.about, phone: user.phone });
  const set = (k, v) => dispatch((s) => ({ ...s, settings: { ...s.settings, [k]: v } }));
  const save = () => {
    if (f.name.trim().length < 2) return toast('Name must be at least 2 characters');
    dispatch((s) => ({ ...s, user: { ...s.user, name: f.name.trim(), about: f.about.trim() || 'Available', phone: f.phone } }));
    setEdit(false); toast('Profile updated');
  };
  const askPerm = (v) => { set('notifications', v); if (v && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission(); };
  return (<>
    <header className="bar"><button className="icon-btn" aria-label="Back" onClick={onClose}><ArrowLeft size={22} /></button><h3>Settings</h3></header>
    <div className="list settings">
      <div className="profile"><Avatar c={user} size={110} />
        {edit ? <div className="form">
          <label>Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label>About<input value={f.about} maxLength={80} onChange={(e) => setF({ ...f, about: e.target.value })} /></label>
          <label>Phone<input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
          <button className="btn sm" onClick={save}><Check size={16} /> Save</button></div>
          : <><h2>{user.name}</h2><p className="sub">{user.about}</p><p className="sub">{user.phone}</p><button className="link" onClick={() => setEdit(true)}><Pencil size={14} /> Edit profile</button></>}
      </div>
      <div className="section">Theme</div>
      <div className="seg" role="radiogroup" aria-label="Theme">{['light', 'dark', 'system'].map((t) => <button key={t} role="radio" aria-checked={st.theme === t} className={st.theme === t ? 'on' : ''} onClick={() => set('theme', t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
      <div className="section">Chat wallpaper</div>
      <div className="walls">{WALLS.map(([k, l]) => <button key={k} aria-label={`${l} wallpaper`} aria-pressed={st.wallpaper === k} className={`wall wp-${k} ${st.wallpaper === k ? 'on' : ''}`} onClick={() => set('wallpaper', k)}><span>{l}</span></button>)}</div>
      <div className="section">Notifications</div>
      <Toggle label="Message notifications" on={st.notifications} set={askPerm} />
      <Toggle label="Sounds" sub="Play a sound for incoming messages" on={st.sounds} set={(v) => set('sounds', v)} />
      <Toggle label="Show previews" sub="Show message text in the chat list" on={st.previews} set={(v) => set('previews', v)} />
      <div className="section">Privacy</div>
      <Toggle label="Read receipts" sub="Turn off to stop blue ticks" on={st.readReceipts} set={(v) => set('readReceipts', v)} />
      <Toggle label="Share last seen & online" sub="If off, you won't see others' either" on={st.lastSeen !== 'nobody'} set={(v) => set('lastSeen', v ? 'everyone' : 'nobody')} />
      <div className="section">Account</div>
      <button className="row" onClick={onLogout}><LogOut size={20} /><div className="name">Log out</div></button>
      <button className="row red" onClick={() => { if (window.confirm('Erase all local session data?')) { onReset(); toast('Data reset'); } }}><Trash2 size={20} /><div className="name">Reset all data</div></button>
    </div>
  </>);
}
