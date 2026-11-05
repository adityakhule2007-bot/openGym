// Small taps for the nutrition screens, on top of openGym's own vibrate() (lib/sound.js), so Settings > Vibrate
// still switches everything off, iOS routes through the native buzzer, and the Android app already holds the VIBRATE permission.
// This adds one extra switch just for nutrition (Nutrition > Goals).
import { vibrate } from '../sound.js'

const KEY = 'opengym:nutrition:haptics'
export const hapticsOn = () => { try { return localStorage.getItem(KEY) !== '0' } catch { return true } }
export const setHaptics = on => { try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* ignore */ } }
const go = p => { if (hapticsOn()) vibrate(p) }

export const tap = () => go(8)                       // a toggle, tab, chip
export const ok = () => go([10, 40, 14])             // something was saved
export const done = () => go([14, 50, 14, 50, 28])   // a ring closed
export const warn = () => go([30, 60, 30])           // a rejected input
