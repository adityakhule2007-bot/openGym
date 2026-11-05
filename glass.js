// Whole-app liquid glass theme: a data attribute on <html>, styled by glass.css. On unless switched off.
const KEY = 'opengym:glass'
export const glassOn = () => { try { return localStorage.getItem(KEY) !== '0' } catch { return true } }
export function applyGlass(on) {
  if (on) document.documentElement.dataset.glass = '1'; else delete document.documentElement.dataset.glass
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* ignore */ }
}

// AMOLED black: with the dark theme, true black backgrounds (pixels switched off on an OLED screen such as the OnePlus 12R),
// dim glass cards and no coloured light behind them. It has no effect in the light theme. Light/Dark/System itself is openGym's own setting.
const AKEY = 'opengym:amoled'
export const amoledOn = () => { try { return localStorage.getItem(AKEY) === '1' } catch { return false } }
export function applyAmoled(on) {
  if (on) document.documentElement.dataset.amoled = '1'; else delete document.documentElement.dataset.amoled
  try { localStorage.setItem(AKEY, on ? '1' : '0') } catch { /* ignore */ }
}

// Glass tint: the colours of the soft light behind the glass. rgb triplets live in glass.css per data-glass-tint.
export const TINTS = [
  { id: 'steel', label: 'Steel', sw: ['#d5dce8', '#8e99ab', '#f1f4fa'] },
  { id: 'aurora', label: 'Aurora', sw: ['#0a84ff', '#bf5af2', '#ff375f'] },
  { id: 'sunset', label: 'Sunset', sw: ['#ff9f0a', '#ff375f', '#bf5af2'] },
  { id: 'ocean', label: 'Ocean', sw: ['#0a84ff', '#40c8e0', '#5e5ce6'] },
  { id: 'forest', label: 'Forest', sw: ['#30d158', '#40c8e0', '#ffd60a'] },
  { id: 'rose', label: 'Rose', sw: ['#ff375f', '#bf5af2', '#ff9f0a'] },
  { id: 'graphite', label: 'Graphite', sw: ['#8e8e93', '#636366', '#aeaeb2'] },
]
const TKEY = 'opengym:glass-tint'
export const getTint = () => { try { const t = localStorage.getItem(TKEY); return TINTS.some(x => x.id === t) ? t : 'steel' } catch { return 'steel' } }
export function applyTint(id) {
  if (!TINTS.some(x => x.id === id)) id = 'steel'
  document.documentElement.dataset.glassTint = id
  try { localStorage.setItem(TKEY, id) } catch { /* ignore */ }
}
