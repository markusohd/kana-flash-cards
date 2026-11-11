// Little sound effects for writing practice, made by the browser (Web Audio),
// so there are no sound files to download.
//   chime(): a bright, rising "ding-ding-ding" when the check passes
//   boop():  a soft, falling "boop" when a stroke is off
// Sounds can be switched off; the choice is saved on this device.

import * as storage from "./storage.js";

const KEY = "writing-sounds";
let context = null; // created on the first sound (browsers need a tap first)

export const soundsOn = () => storage.load(KEY, true);
export const setSoundsOn = (on) => storage.save(KEY, on);

function audio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null; // very old browser: stay silent
  context ??= new Ctx();
  if (context.state === "suspended") context.resume();
  return context;
}

// One soft note: frequency in Hz, start and length in seconds, optional slide to `endFreq`.
function note(ctx, freq, start, length, { type = "sine", volume = 0.18, endFreq = null } = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ctx.currentTime + start;
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + length);
  // Quick fade in and a gentle fade out, so it sounds round, not clicky.
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

export function chime() {
  if (!soundsOn()) return;
  const ctx = audio();
  if (!ctx) return;
  // C6, E6, G6: a happy little arpeggio, plus a high sparkle on top.
  note(ctx, 1046.5, 0, 0.18, { type: "triangle" });
  note(ctx, 1318.5, 0.09, 0.18, { type: "triangle" });
  note(ctx, 1568.0, 0.18, 0.32, { type: "triangle" });
  note(ctx, 2093.0, 0.26, 0.25, { volume: 0.06 });
}

export function boop() {
  if (!soundsOn()) return;
  const ctx = audio();
  if (!ctx) return;
  // A soft, slightly wobbly "boo-op" sliding down. Friendly, not a buzzer.
  note(ctx, 330, 0, 0.16, { endFreq: 260, volume: 0.2 });
  note(ctx, 247, 0.14, 0.24, { endFreq: 196, volume: 0.2 });
}
