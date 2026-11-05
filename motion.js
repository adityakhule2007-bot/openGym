// Motion switch for the nutrition screens and a count-up hook for the big numbers.
// Animations are CSS (nutrition.css) and already sit behind prefers-reduced-motion (Android "Remove animations" sets it);
// this adds an in-app switch (html[data-ng-motion="0"]) so the person can turn them off without touching the phone settings.
import { useEffect, useRef, useState } from 'react'

const KEY = 'opengym:nutrition:motion'
export const motionOn = () => { try { return localStorage.getItem(KEY) !== '0' } catch { return true } }
export function applyMotion(on) {
  if (on) delete document.documentElement.dataset.ngMotion; else document.documentElement.dataset.ngMotion = '0'
  try { localStorage.setItem(KEY, on ? '1' : '0') } catch { /* ignore */ }
}
const reduced = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Eased count from the last shown value to `target` (first run: from 0). Jumps straight there when motion is off.
export function useCountUp(target, ms = 650) {
  const [v, setV] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (!motionOn() || reduced()) { from.current = target; setV(target); return }
    const a = from.current, t0 = performance.now()
    let id
    const step = now => {
      const p = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - p, 3)
      from.current = a + (target - a) * e
      setV(from.current)
      if (p < 1) id = requestAnimationFrame(step)
    }
    id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [target, ms])
  return v
}

// Ids that appeared since the last render (not on the first), for a short "just added" highlight.
export function useNewIds(ids, hold = 900) {
  const seen = useRef(null)
  const [fresh, setFresh] = useState(() => new Set())
  const key = ids.join('|')
  useEffect(() => {
    if (seen.current === null) { seen.current = new Set(ids); return }
    const add = ids.filter(i => !seen.current.has(i))
    seen.current = new Set(ids)
    if (!add.length) return
    setFresh(new Set(add))
    const t = setTimeout(() => setFresh(new Set()), hold)
    return () => clearTimeout(t)
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return fresh
}
