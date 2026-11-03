import { useEffect, useState } from 'react'

// Apple-Activity-style concentric rings: one per macro, a hairline ring for calories outside them.
// Past 100% a ring laps over itself with a soft shadow, like the Activity rings do.
const RINGS = [
  { key: 'p', label: 'Protein', r: 96, a: '#0a84ff', b: '#64d2ff' },
  { key: 'c', label: 'Carbs', r: 76, a: '#ff9f0a', b: '#ffd479' },
  { key: 'f', label: 'Fat', r: 56, a: '#bf5af2', b: '#e8b4ff' },
]
const SW = 16, CX = 120

function Arc({ r, frac, grad, color, lap }) {
  const C = 2 * Math.PI * r
  const L = Math.max(0, Math.min(1, frac)) * C
  return <circle cx={CX} cy={CX} r={r} className={'ng-arc' + (lap ? ' lap' : '')} style={{ '--c': color }} fill="none" stroke={`url(#${grad})`} strokeWidth={SW}
    strokeLinecap="round" strokeDasharray={`${L} ${C}`} opacity={L < 0.5 ? 0 : 1} transform={`rotate(-90 ${CX} ${CX})`} />
}

export default function NutritionRings({ kcal, kcalGoal, macros }) {
  const [on, setOn] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id) }, [])
  const left = Math.round(kcalGoal - kcal)
  const over = left < 0
  const kfrac = on ? kcal / Math.max(1, kcalGoal) : 0
  const KC = 2 * Math.PI * 112
  return <div className="ng-rings">
    <div className="ng-ringbox">
      <svg viewBox="0 0 240 240" role="img" aria-label={`${Math.abs(left)} kilocalories ${over ? 'over' : 'left'}`}>
        <defs>
          {RINGS.map(g => <linearGradient key={g.key} id={'ngg-' + g.key} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={g.a} /><stop offset="1" stopColor={g.b} /></linearGradient>)}
        </defs>
        <circle cx={CX} cy={CX} r="112" className="ng-track" fill="none" strokeWidth="4" />
        <circle cx={CX} cy={CX} r="112" className="ng-kring" fill="none" strokeWidth="4" strokeLinecap="round" transform={`rotate(-90 ${CX} ${CX})`}
          strokeDasharray={`${Math.min(1, Math.max(0, kfrac)) * KC} ${KC}`} opacity={kfrac * KC < 0.5 ? 0 : 1} />
        {RINGS.map(g => {
          const m = macros.find(x => x.key === g.key), p = on ? m.value / Math.max(1, m.goal) : 0
          return <g key={g.key}>
            <circle cx={CX} cy={CX} r={g.r} className="ng-track" fill="none" strokeWidth={SW} />
            <Arc r={g.r} frac={p} grad={'ngg-' + g.key} color={g.a} />
            {p > 1 && <Arc r={g.r} frac={p - 1} grad={'ngg-' + g.key} color={g.a} lap />}
          </g>
        })}
      </svg>
      <div className="ng-ringtxt">
        <b className={over ? 'over' : ''}>{Math.abs(left).toLocaleString()}</b>
        <small>{over ? 'kcal over' : 'kcal left'}</small>
      </div>
    </div>
    <div className="ng-legend">
      {RINGS.map(g => {
        const m = macros.find(x => x.key === g.key), rem = Math.round(m.goal - m.value)
        return <div key={g.key} className="ng-lg">
          <span className="ng-dot" style={{ background: `linear-gradient(135deg, ${g.a}, ${g.b})` }} />
          <div><small>{g.label}</small><b>{Math.round(m.value)}<i> / {m.goal} g</i></b><em>{rem >= 0 ? rem + ' g left' : -rem + ' g over'}</em></div>
        </div>
      })}
    </div>
  </div>
}
