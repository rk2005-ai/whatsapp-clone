import { useState } from 'react';
import { MessageCircle, CircleDashed, Phone, Plus, MoreVertical, Search, X, Pin, Star, Check, CheckCheck, Settings as Cog, Moon, Sun, LogOut, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video, Camera, Pencil } from 'lucide-react';
import Avatar from './Avatar.jsx';
import { listTime, preview, fmtTime } from '../utils/format.js';

const FILTERS = [['all', 'All'], ['unread', 'Unread'], ['fav', 'Favorites'], ['groups', 'Groups']];
const Skeleton = () => <div>{[...Array(7)].map((_, i) => <div className="row skel" key={i}><div className="avatar sk" style={{ width: 49, height: 49 }} /><div className="grow"><div className="sk line" style={{ width: '55%' }} /><div className="sk line" style={{ width: '85%' }} /></div></div>)}</div>;

export default function Sidebar({ state, dispatch, tab, setTab, activeId, openChat, setPanel, setModal, loading, typing, onLogout, startCall }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [menu, setMenu] = useState(false);
  const { user, contacts, chats, settings, statuses, myStatus, calls } = state;
  const dark = document.documentElement.dataset.theme === 'dark';
  const toggleTheme = () => { dispatch((s) => ({ ...s, settings: { ...s.settings, theme: dark ? 'light' : 'dark' } })); setMenu(false); };
  const ct = (id) =>
    contacts.find((c) => c.id === id || c._id === id || c.userId === id);
  const lastTs = (c) => c.messages[c.messages.length - 1]?.ts || 0;

  const items = Object.entries(chats).map(([id, c]) => ({ id, c, p: ct(id) })).filter((x) => x.p)
    .filter(({ c, p }) => {
      if (filter === 'unread' && !c.unread) return false;
      if (filter === 'fav' && !p.fav) return false;
      if (filter === 'groups' && !p.group) return false;
      if (!q.trim()) return true;
      const s = q.toLowerCase();
      return p.name.toLowerCase().includes(s) || c.messages.some((m) => !m.deleted && m.text?.toLowerCase().includes(s));
    })
    .sort((a, b) => (+!!b.c.pinned - +!!a.c.pinned) || lastTs(b.c) - lastTs(a.c));

  const unreadTotal = Object.values(chats).filter((c) => c.unread).length;
  const fresh = statuses.filter((s) => !s.viewed && (ct(s.contactId) || s.name));
  const viewed = statuses.filter((s) => s.viewed && (ct(s.contactId) || s.name));

  const StatusRow = ({ s }) => {
    const p = ct(s.contactId) || s; const last = s.items[s.items.length - 1];
    return <button className="row" onClick={() => setModal({ type: 'story', id: s.id })}><Avatar c={p} size={49} ring={s.viewed ? 'ring-seen' : 'ring-new'} /><div className="grow"><div className="name">{p.name}</div><div className="sub">{listTime(last.ts)}</div></div></button>;
  };

  return (<>
    <header className="bar">
      <Avatar c={user} size={40} onClick={() => setPanel('settings')} />
      <div className="grow" />
      {[['chats', MessageCircle, 'Chats'], ['status', CircleDashed, 'Status'], ['calls', Phone, 'Calls']].map(([k, I, l]) => (
        <button key={k} className={`icon-btn ${tab === k ? 'active' : ''} ${k === 'chats' && unreadTotal ? 'dot' : ''}`} aria-label={l} title={l} onClick={() => setTab(k)}><I size={22} /></button>))}
      <button className="icon-btn" aria-label="New chat" title="New chat" onClick={() => setModal({ type: 'new' })}><Plus size={22} /></button>
      <div className="menu-wrap">
        <button className="icon-btn" aria-label="Menu" aria-haspopup="menu" onClick={() => setMenu(!menu)}><MoreVertical size={22} /></button>
        {menu && <><div className="scrim" onClick={() => setMenu(false)} /><div className="menu" role="menu">
          <button role="menuitem" onClick={() => { setPanel('settings'); setMenu(false); }}><Cog size={16} /> Settings</button>
          <button role="menuitem" onClick={toggleTheme}>{dark ? <Sun size={16} /> : <Moon size={16} />} {dark ? 'Light mode' : 'Dark mode'}</button>
          <button role="menuitem" onClick={onLogout}><LogOut size={16} /> Log out</button></div></>}
      </div>
    </header>

    {tab === 'chats' && <>
      <div className="search"><Search size={16} /><input aria-label="Search chats" placeholder="Search or start a new chat" value={q} onChange={(e) => setQ(e.target.value)} />{q && <button className="icon-btn sm" aria-label="Clear search" onClick={() => setQ('')}><X size={16} /></button>}</div>
      <div className="chips" role="tablist">{FILTERS.map(([k, l]) => <button key={k} role="tab" aria-selected={filter === k} className={`chip ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}</div>
      <div className="list">
        {loading ? <Skeleton /> : items.length === 0 ? (
          <div className="empty">{q ? <><Search size={36} /><p>No results for “{q}”</p><span>Try a different name or message.</span></> : filter !== 'all' ? <><MessageCircle size={36} /><p>No {FILTERS.find((f) => f[0] === filter)[1].toLowerCase()} chats</p><button className="link" onClick={() => setFilter('all')}>Show all chats</button></> : <><MessageCircle size={36} /><p>No chats yet</p><button className="btn sm" onClick={() => setModal({ type: 'new' })}>Start a chat</button></>}</div>
        ) : items.map(({ id, c, p }) => {
          const last = c.messages[c.messages.length - 1];
          const online = !p.group && p.online && settings.lastSeen !== 'nobody';
          return (
            <button key={id} className={`row ${activeId === id ? 'sel' : ''}`} onClick={() => openChat(id)}>
              <div className="av-wrap"><Avatar c={p} size={49} />{online && <i className="online" aria-label="online" />}</div>
              <div className="grow">
                <div className="line1"><span className="name">{p.name}</span><span className={`time ${c.unread ? 'g' : ''}`}>{last ? listTime(last.ts) : ''}</span></div>
                <div className="line1 sub">
                  <span className="prev">{typing[id] ? <em className="g">typing…</em> : <>
                    {last?.from === 'me' && !last.deleted && (last.status === 'sent' ? <Check size={15} /> : <CheckCheck size={15} className={last.status === 'read' ? 'blue' : ''} />)}
                    {settings.previews || !last ? preview(last) : 'New message'}</>}</span>
                  <span className="badges">{p.fav && <Star size={13} />}{c.pinned && <Pin size={14} />}{c.unread > 0 && <b className="badge">{c.unread}</b>}</span>
                </div>
              </div>
            </button>);
        })}
      </div></>}

    {tab === 'status' && <div className="list">
      <div className="row"><button className="row bare" onClick={() => myStatus.length ? setModal({ type: 'story', id: 'me' }) : setModal({ type: 'addStatus' })}><Avatar c={user} size={49} ring={myStatus.length ? 'ring-new' : ''} /><div className="grow"><div className="name">My status</div><div className="sub">{myStatus.length ? `${myStatus.length} update${myStatus.length > 1 ? 's' : ''} · ${listTime(myStatus[myStatus.length - 1].ts)}` : 'Tap to add status update'}</div></div></button>
        <button className="icon-btn" aria-label="Add status" onClick={() => setModal({ type: 'addStatus' })}><Pencil size={20} /></button></div>
      {fresh.length > 0 && <><div className="section">Recent updates</div>{fresh.map((s) => <StatusRow key={s.id} s={s} />)}</>}
      {viewed.length > 0 && <><div className="section">Viewed updates</div>{viewed.map((s) => <StatusRow key={s.id} s={s} />)}</>}
      {!fresh.length && !viewed.length && <div className="empty"><CircleDashed size={36} /><p>No status updates</p></div>}
    </div>}

    {tab === 'calls' && <div className="list">
      <div className="section">Recent</div>
      {calls.length === 0 ? <div className="empty"><Phone size={36} /><p>No recent calls</p><span>Start a call from any chat.</span></div> : calls.map((k) => {
        const p = ct(k.contactId); if (!p) return null;
        const I = k.missed ? PhoneMissed : k.dir === 'in' ? PhoneIncoming : PhoneOutgoing;
        return <div className="row" key={k.id}><Avatar c={p} size={49} /><div className="grow"><div className={`name ${k.missed ? 'red' : ''}`}>{p.name}</div><div className="sub"><I size={14} className={k.missed ? 'red' : 'g'} /> {listTime(k.ts)}, {fmtTime(k.ts)}</div></div>
          <button className="icon-btn g" aria-label={`${k.type === 'video' ? 'Video' : 'Voice'} call ${p.name}`} onClick={() => startCall(p.id, k.type)}>{k.type === 'video' ? <Video size={20} /> : <Phone size={20} />}</button></div>;
      })}
    </div>}
  </>);
}
