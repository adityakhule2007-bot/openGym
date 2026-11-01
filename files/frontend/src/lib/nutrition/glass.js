// Whole-app liquid glass theme: a data attribute on <html>, styled by glass.css. On unless switched off.
const KEY = 'opengym:glass'
export const glassOn = () => { try { return localStorage.getItem(KEY) !== '0' } catch { return true } }
export function applyGlass(on) {
  if (on) document.documentElement.dataset.glass = '1'; else delete document.documentElement.dataset.glass
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* ignore */ }
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
