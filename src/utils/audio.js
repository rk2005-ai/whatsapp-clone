export function playRingTone() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return () => {};
    const ctx = new AudioContext();

    let isPlaying = true;
    let timer = null;

    const beep = () => {
      if (!isPlaying || ctx.state === 'closed') return;
      try {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.frequency.value = 440;
        osc2.frequency.value = 480;
        gain.gain.value = 0.05;

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start();
        osc2.start();

        // 1.5s on, 2s off ringback pattern
        setTimeout(() => {
          try {
            osc1.stop();
            osc2.stop();
          } catch {}
          if (isPlaying) {
            timer = setTimeout(beep, 2000);
          }
        }, 1500);
      } catch {}
    };

    beep();

    return () => {
      isPlaying = false;
      if (timer) clearTimeout(timer);
      try {
        ctx.close();
      } catch {}
    };
  } catch {
    return () => {};
  }
}

export function playIncomingRing() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return () => {};
    const ctx = new AudioContext();

    let isPlaying = true;
    let timer = null;

    const ring = () => {
      if (!isPlaying || ctx.state === 'closed') return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.15); // G5
        osc.frequency.setValueAtTime(987.77, ctx.currentTime + 0.3); // B5

        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.8);

        if (isPlaying) {
          timer = setTimeout(ring, 1400);
        }
      } catch {}
    };

    ring();

    return () => {
      isPlaying = false;
      if (timer) clearTimeout(timer);
      try {
        ctx.close();
      } catch {}
    };
  } catch {
    return () => {};
  }
}
