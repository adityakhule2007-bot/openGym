import { useMemo, useState } from 'react'
import { dailySeries, averageOf } from '../lib/nutrition/trends.js'

const W = 340, H = 150, PX = 8, PT = 10, PB = 22
const r0 = n => Math.round(n)

// Smooth line through points (Catmull-Rom to cubic bezier).
function smooth(pts) {
  if (pts.length < 2) return ''
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`
  }
  return d
}
const xAt = (i, n) => PX + (n <= 1 ? 0 : i * (W - 2 * PX) / (n - 1))
const labels = days => days.map((d, i) => <text key={d.day} x={xAt(i, days.length)} y={H - 6} className="ng-ax" textAnchor="middle">{days.length > 8 && i % 2 ? '' : d.wd}</text>)

function LineArea({ days }) {
  const goalK = days.goal
  const max = Math.max(goalK * 1.15, ...days.map(d => d.k), 1)
  const y = v => PT + (H - PT - PB) * (1 - v / max)
  const pts = days.map((d, i) => [xAt(i, days.length), y(d.k)])
  const line = smooth(pts)
  return <svg viewBox={`0 0 ${W} ${H}`} className="ng-chart" role="img" aria-label="Calories per day">
    <defs><linearGradient id="ngkA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--acc)" stopOpacity=".45" /><stop offset="1" stopColor="var(--acc)" stopOpacity="0" /></linearGradient></defs>
    <line x1={PX} x2={W - PX} y1={y(goalK)} y2={y(goalK)} className="ng-goal" />
    <text x={W - PX} y={y(goalK) - 4} className="ng-ax" textAnchor="end">goal {r0(goalK)}</text>
    {line && <path d={`${line} L${pts[pts.length - 1][0]},${H - PB} L${pts[0][0]},${H - PB} Z`} fill="url(#ngkA)" />}
    {line && <path d={line} className="ng-line" />}
    {pts.map((p, i) => days[i].logged && <circle key={i} cx={p[0]} cy={p[1]} r="3.2" className="ng-dotpt" />)}
    {labels(days)}
  </svg>
}

function Bars({ days, series, goalLine, unit }) {
  const n = days.length, k = series.length
  const max = Math.max(goalLine || 0, ...days.flatMap(d => series.map(s => d[s.key] || 0)), 1) * 1.12
  const y = v => PT + (H - PT - PB) * (1 - v / max)
  const slot = (W - 2 * PX) / n, bw = Math.min(14, (slot * 0.78) / k)
  return <svg viewBox={`0 0 ${W} ${H}`} className="ng-chart" role="img" aria-label={unit}>
    <defs>{series.map(s => <linearGradient key={s.key} id={'ngb-' + s.key} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.a} /><stop offset="1" stopColor={s.b} /></linearGradient>)}</defs>
    {goalLine > 0 && <><line x1={PX} x2={W - PX} y1={y(goalLine)} y2={y(goalLine)} className="ng-goal" /><text x={W - PX} y={y(goalLine) - 4} className="ng-ax" textAnchor="end">goal {goalLine}{unit}</text></>}
    {days.map((d, i) => series.map((s, j) => {
      const h = Math.max(0, (H - PB) - y(d[s.key] || 0)), x = PX + slot * i + (slot - bw * k) / 2 + bw * j
      return h > 0.5 ? <rect key={d.day + s.key} x={x} y={H - PB - h} width={bw - 1.5} height={h} rx={Math.min(5, (bw - 1.5) / 2)} fill={`url(#ngb-${s.key})`} /> : null
    }))}
    {days.map((d, i) => <text key={d.day} x={PX + slot * i + slot / 2} y={H - 6} className="ng-ax" textAnchor="middle">{n > 8 && i % 2 ? '' : d.wd}</text>)}
  </svg>
}

const MACRO = [{ key: 'p', a: '#64d2ff', b: '#0a84ff', label: 'Protein' }, { key: 'c', a: '#ffd479', b: '#ff9f0a', label: 'Carbs' }, { key: 'f', a: '#e8b4ff', b: '#bf5af2', label: 'Fat' }]
const WATER = [{ key: 'w', a: '#8be9ff', b: '#30b0ff' }]

export default function NutritionCharts({ entries, water, endDay, goals }) {
  const [n, setN] = useState(7)
  const days = useMemo(() => dailySeries(entries, water, endDay, n), [entries, water, endDay, n])
  const kd = useMemo(() => Object.assign(days.map(d => ({ ...d })), { goal: goals.kcal }), [days, goals.kcal])
  const wd = useMemo(() => days.map(d => ({ ...d, w: d.water / 1000 })), [days])
  const logged = days.filter(d => d.logged).length
  return <>
    <div className="ng-seg ng-range">{[7, 14].map(v => <button key={v} className={n === v ? 'on' : ''} onClick={() => setN(v)}>{v} days</button>)}</div>
    <div className="ng-stats">
      <div className="card"><small>Avg calories</small><b>{r0(averageOf(days, 'k')).toLocaleString()}</b></div>
      <div className="card"><small>Avg protein</small><b>{r0(averageOf(days, 'p'))} g</b></div>
      <div className="card"><small>Days logged</small><b>{logged}/{n}</b></div>
    </div>
    <div className="card"><div className="ng-cardhd"><b>Calories</b><small>per day</small></div><LineArea days={kd} /></div>
    <div className="card"><div className="ng-cardhd"><b>Macro intake</b><small>grams per day</small></div>
      <Bars days={days} series={MACRO} unit="g" />
      <div className="ng-legend2">{MACRO.map(m => <span key={m.key}><i style={{ background: `linear-gradient(135deg, ${m.a}, ${m.b})` }} />{m.label}</span>)}</div></div>
    <div className="card"><div className="ng-cardhd"><b>Hydration</b><small>litres per day</small></div>
      <Bars days={wd} series={WATER} goalLine={Math.round(goals.water / 100) / 10} unit="L" /></div>
  </>
}
