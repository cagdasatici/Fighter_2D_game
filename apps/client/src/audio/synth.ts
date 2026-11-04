/**
 * Pure parameter tables for the original synthesized combat sounds (spec §13). No DOM, no samples, no recordings.
 * Adapted from the battlegrounds synth.ts per decision 0006: same Layer/Recipe model, voice cap, priorities and
 * attenuation; sound keys replaced with Knockout Bash keys.
 */

export type SoundKind =
  | "hitL" | "hitM" | "hitH" | "block" | "whiff" | "jump" | "land"
  | "projRivet" | "projSpark" | "projEgg" | "projShuriken" | "projJade"
  | "super" | "ko";

export interface Layer {
  src: "osc" | "noise";
  wave?: "sine" | "square" | "sawtooth" | "triangle";
  /** Start and end frequency (Hz) for an oscillator, or the filter cutoff sweep for noise. */
  f0: number;
  f1: number;
  filter?: "lowpass" | "bandpass" | "highpass";
  gain: number;
  /** Seconds. */
  attack: number;
  dur: number;
  /** Delay before the layer starts, seconds. */
  delay?: number;
  /** Amplitude modulation rate in Hz (tremolo / crackle). */
  crackleHz?: number;
}

export interface Recipe { layers: Layer[]; dur: number }

const r = (layers: Layer[]): Recipe => ({ layers, dur: Math.max(...layers.map((l) => (l.delay ?? 0) + l.dur)) });

const hit = (noiseMs: number, cutoff: number, thumpHz: number, gain: number): Recipe => r([
  { src: "noise", f0: cutoff, f1: cutoff * 0.6, filter: "lowpass", gain, attack: 0.002, dur: noiseMs / 1000 },
  { src: "osc", wave: "sine", f0: thumpHz, f1: thumpHz * 0.6, gain, attack: 0.002, dur: noiseMs / 1000 + 0.04 },
]);

export const RECIPES: Record<SoundKind, Recipe> = {
  hitL: hit(30, 2500, 180, 0.5),
  hitM: hit(50, 1800, 140, 0.65),
  hitH: hit(80, 1200, 90, 0.8),
  block: r([
    { src: "osc", wave: "square", f0: 900, f1: 900, gain: 0.35, attack: 0.001, dur: 0.025 },
    { src: "noise", f0: 3000, f1: 3000, filter: "highpass", gain: 0.4, attack: 0.001, dur: 0.02 },
  ]),
  whiff: r([{ src: "noise", f0: 1500, f1: 600, filter: "bandpass", gain: 0.3, attack: 0.01, dur: 0.09 }]),
  jump: r([{ src: "osc", wave: "sine", f0: 300, f1: 500, gain: 0.25, attack: 0.004, dur: 0.06 }]),
  land: r([{ src: "noise", f0: 400, f1: 400, filter: "lowpass", gain: 0.4, attack: 0.002, dur: 0.04 }]),
  projRivet: r([
    { src: "osc", wave: "square", f0: 1200, f1: 1150, gain: 0.2, attack: 0.001, dur: 0.12 },
    { src: "osc", wave: "square", f0: 1214, f1: 1164, gain: 0.2, attack: 0.001, dur: 0.12 },
  ]),
  projSpark: r([{ src: "osc", wave: "sawtooth", f0: 2000, f1: 2000, gain: 0.2, attack: 0.005, dur: 0.18, crackleHz: 40 }]),
  projEgg: r([{ src: "osc", wave: "sine", f0: 600, f1: 200, gain: 0.45, attack: 0.002, dur: 0.1 }]),
  projShuriken: r([{ src: "noise", f0: 800, f1: 3000, filter: "bandpass", gain: 0.35, attack: 0.02, dur: 0.14 }]),
  projJade: r([
    { src: "osc", wave: "sine", f0: 523, f1: 523, gain: 0.22, attack: 0.02, dur: 0.4 },
    { src: "osc", wave: "sine", f0: 659, f1: 659, gain: 0.22, attack: 0.02, dur: 0.4 },
    { src: "osc", wave: "sine", f0: 784, f1: 784, gain: 0.22, attack: 0.02, dur: 0.4 },
  ]),
  // "Reverb tail" approximated by delayed, quieter echoes of the sweep end (no convolver; decision 0006).
  super: r([
    { src: "osc", wave: "sawtooth", f0: 200, f1: 1200, gain: 0.35, attack: 0.05, dur: 0.4 },
    { src: "osc", wave: "sawtooth", f0: 1200, f1: 1100, gain: 0.15, attack: 0.01, dur: 0.3, delay: 0.4 },
    { src: "noise", f0: 3000, f1: 800, filter: "bandpass", gain: 0.12, attack: 0.05, dur: 0.5, delay: 0.4 },
  ]),
  ko: r([
    { src: "osc", wave: "sine", f0: 60, f1: 40, gain: 0.9, attack: 0.005, dur: 0.6 },
    { src: "osc", wave: "square", f0: 880, f1: 880, gain: 0.2, attack: 0.005, dur: 0.18, delay: 0.1 },
    { src: "osc", wave: "square", f0: 440, f1: 440, gain: 0.2, attack: 0.005, dur: 0.3, delay: 0.3 },
  ]),
};

/** Lower number = more important. */
export type Priority = 0 | 1 | 2;
export const PRIORITY_IMPACT: Priority = 0;
export const PRIORITY_MAJOR: Priority = 1;
export const PRIORITY_OTHER: Priority = 2;

export const MAX_VOICES = 16;
export const MAX_AUDIBLE_M = 45;

/** Linear fall-off: 1 at 0 m, 0.5 at 22.5 m, 0 at 45 m and beyond. Single-screen fights pass 0. */
export function attenuation(distM: number): number {
  if (!(distM >= 0)) return 0;
  return Math.max(0, 1 - distM / MAX_AUDIBLE_M);
}
