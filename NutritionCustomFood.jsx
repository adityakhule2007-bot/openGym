import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { META, ORDER, GNAME, buildCustomFood, valuesPer } from '../lib/nutrition/engine.js'

const MACRO = [['k', 'Calories', 'kcal'], ['p', 'Protein', 'g'], ['c', 'Carbohydrates', 'g'], ['f', 'Fat', 'g']]

// Create or edit a custom food. Every nutrient is optional apart from calories (or macros to work them out).
export default function CustomFoodForm({ initial, onSave, onCancel, onDelete }) {
  const editing = !!initial?.custom
  const [name, setName] = useState(initial?.n || '')
  const [brand, setBrand] = useState(initial?.brand || '')
  const perServing = Array.isArray(initial?.v) && initial.u === 's'   // an Open Food Facts food that is per serving, weight unknown
  const [sLabel, setSLabel] = useState(initial?.sv?.[0]?.l || (perServing && initial.s) || '1 serving')
  const [sG, setSG] = useState(String(initial?.sv?.[0]?.g || 100))
  const [extra, setExtra] = useState((initial?.sv || []).slice(1).map(x => ({ l: x.l, g: String(x.g) })))
  // An existing food (mine, or an Open Food Facts one being corrected) opens with its values per 100 g; a new one starts empty, per serving.
  const hasValues = Array.isArray(initial?.v)
  const [basis, setBasis] = useState(hasValues && !perServing ? '100' : 'serving')
  const [vals, setVals] = useState(hasValues ? valuesPer(initial, 100) : {})
  const [open, setOpen] = useState({})
  const [err, setErr] = useState('')
  const set = (k, v) => setVals(o => ({ ...o, [k]: v }))

  const save = () => {
    const n = name.trim()
    if (!n) return setErr('Give the food a name.')
    if (!(parseFloat(sG) > 0)) return setErr('Enter the serving size in grams.')
    const v = { ...vals }
    if (!(parseFloat(v.k) >= 0) || v.k === '' || v.k == null) {
      const p = parseFloat(v.p) || 0, c = parseFloat(v.c) || 0, f = parseFloat(v.f) || 0
      if (p + c + f > 0) v.k = String(Math.round(4 * p + 4 * c + 9 * f)); else return setErr('Enter the calories (or protein, carbs and fat).')
    }
    onSave(buildCustomFood({ id: initial?.id, name: n, brand, servingLabel: sLabel, servingG: sG, basis, values: v, extra, ean: initial?.ean }))
  }
  const field = (k, label, unit) => <label className="ng-f" key={k}><span>{label}<i>{unit}</i></span>
    <input className="ng-in" inputMode="decimal" value={vals[k] ?? ''} onChange={e => set(k, e.target.value)} /></label>

  return <div className="ng-form">
    <div className="ng-sheet-hd"><button className="iconbtn" onClick={onCancel} aria-label="Back"><Icon name="chevronLeft" /></button><b>{editing ? 'Edit food' : initial?.ean ? 'Add product' : 'New custom food'}</b><span style={{ width: 36 }} /></div>
    <input className="ng-in" placeholder="Name (e.g. Homemade protein bar)" value={name} onChange={e => setName(e.target.value)} />
    <input className="ng-in" placeholder="Brand (optional)" value={brand} onChange={e => setBrand(e.target.value)} />
    {initial?.ean && <p className="ng-muted">Barcode {initial.ean} is saved with this food, so scanning it finds it next time. Copy the numbers from the pack’s nutrition panel (supplements: the per-serving column, with the scoop weight in grams as the serving size).</p>}

    <div className="ng-sec">Serving size</div>
    <div className="ng-grid2">
      <label className="ng-f"><span>Name</span><input className="ng-in" value={sLabel} onChange={e => setSLabel(e.target.value)} /></label>
      <label className="ng-f"><span>Weight<i>g</i></span><input className="ng-in" inputMode="decimal" value={sG} onChange={e => setSG(e.target.value)} /></label>
    </div>
    {extra.map((x, i) => <div className="ng-grid2 ng-xs" key={i}>
      <input className="ng-in" placeholder="e.g. 1 cup" value={x.l} onChange={e => setExtra(extra.map((y, j) => j === i ? { ...y, l: e.target.value } : y))} />
      <div className="ng-row"><input className="ng-in" inputMode="decimal" placeholder="grams" value={x.g} onChange={e => setExtra(extra.map((y, j) => j === i ? { ...y, g: e.target.value } : y))} />
        <button className="iconbtn" onClick={() => setExtra(extra.filter((_, j) => j !== i))} aria-label="Remove serving"><Icon name="xmark" /></button></div>
    </div>)}
    <button className="ng-link" onClick={() => setExtra([...extra, { l: '', g: '' }])}>+ Add another serving size</button>

    <div className="ng-sec">Nutrition values per</div>
    <div className="ng-seg"><button className={basis === 'serving' ? 'on' : ''} onClick={() => setBasis('serving')}>1 serving ({parseFloat(sG) || 0} g)</button><button className={basis === '100' ? 'on' : ''} onClick={() => setBasis('100')}>100 g</button></div>
    <div className="ng-grid2">{MACRO.map(([k, l, u]) => field(k, l, u))}</div>

    {Object.keys(ORDER).map(g => <div key={g}>
      <button className="ng-acc" onClick={() => setOpen(o => ({ ...o, [g]: !o[g] }))}><span>{GNAME[g]}</span><Icon name={open[g] ? 'chevronUp' : 'chevronDown'} /></button>
      {open[g] && <div className="ng-grid2">{ORDER[g].map(k => field(k, META[k].l, META[k].u))}</div>}
    </div>)}

    {err && <p className="ng-err">{err}</p>}
    <div className="ng-row"><button className="ng-btn" onClick={save}>{editing ? 'Save changes' : 'Save food'}</button></div>
    {editing && <button className="ng-link danger" onClick={() => onDelete(initial)}>Delete this food</button>}
  </div>
}
