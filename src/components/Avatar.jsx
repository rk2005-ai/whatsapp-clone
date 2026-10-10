import { useState } from 'react';
export default function Avatar({ c, size = 40, ring = '', onClick }) {
  const [bad, setBad] = useState(false);
  const name = c?.name || '?';
  const ini = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const hue = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360;
  return (
    <div className={`avatar ${ring}`} style={{ width: size, height: size, fontSize: size / 2.6, background: `hsl(${hue} 45% 45%)` }}
      onClick={onClick} role={onClick ? 'button' : undefined} aria-label={onClick ? `Open ${name}` : undefined}>
      {c?.avatar && !bad ? <img src={c.avatar} alt={name} onError={() => setBad(true)} /> : ini}
    </div>
  );
}
