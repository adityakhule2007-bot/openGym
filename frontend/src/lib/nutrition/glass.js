// Whole-app liquid glass theme: an opt-in data attribute on <html>, styled by glass.css.
const KEY = 'opengym:glass'
export const glassOn = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
export function applyGlass(on) {
  if (on) document.documentElement.dataset.glass = '1'; else delete document.documentElement.dataset.glass
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* ignore */ }
}
