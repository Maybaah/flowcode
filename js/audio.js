"use strict";
/* flowcode — sound (WebAudio, no asset files) */
const Sfx = (() => {
  let ctx = null, master = null, on = true;

  function ensure() {
    if (!on) return false;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { on = false; return false; }
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return true;
  }

  function tone(freq, dur, { type = "sine", gain = 1, delay = 0, slide = 0 } = {}) {
    if (!ensure()) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  return {
    get enabled() { return on; },
    setEnabled(v) { on = !!v; if (on) ensure(); },
    toggle() { on = !on; if (on) ensure(); return on; },
    key()    { tone(720 + Math.random() * 160, 0.045, { type: "triangle", gain: 0.5 }); },
    error()  { tone(130, 0.14, { type: "sawtooth", gain: 0.5 }); },
    word()   { tone(523, 0.07, { type: "triangle", gain: 0.7 }); tone(784, 0.09, { type: "triangle", gain: 0.7, delay: 0.06 }); },
    miss()   { tone(340, 0.28, { type: "sawtooth", gain: 0.45, slide: -260 }); },
    combo()  { tone(880, 0.06, { gain: 0.6 }); tone(1175, 0.1, { gain: 0.6, delay: 0.05 }); },
    power()  { [660, 880, 1320].forEach((f, i) => tone(f, 0.09, { type: "triangle", gain: 0.6, delay: i * 0.06 })); },
    over()   { tone(220, 0.4, { type: "triangle", gain: 0.6, slide: -120 }); tone(110, 0.5, { type: "sine", gain: 0.5, delay: 0.1 }); },
    record() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, { type: "square", gain: 0.35, delay: i * 0.09 })); },
  };
})();
