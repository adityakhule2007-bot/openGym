import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { MOBILE } from '../lib/mobile.js'
import { scanCode } from '../lib/scan.js'
import { useNutrition } from '../lib/nutrition/store.js'
import { searchOFF, barcodeOFF } from '../lib/nutrition/off.js'
import {
  META, ORDER, GNAME, IDX, hhmm, atOf, unitsFor, defaultAmount, entryFromUnit, entryFromMacros,
  searchFoods, foodFromRow, looksLikeBarcode, fmtQty,
} from '../lib/nutrition/engine.js'
import CustomFoodForm from './NutritionCustomFood.jsx'

const url = name => new URL('nutrition/' + name, document.baseURI).href
const r0 = n => Math.round(n)
const fmt = x => (x >= 10 ? String(Math.round(x)) : x >= 1 ? String(Math.round(x * 10) / 10) : String(Math.round(x * 100) / 100))
let coreCache = null, moreCache = null
const loadCore = () => coreCache || (coreCache = fetch(url('foods-core.json'), { cache: 'force-cache' }).then(r => r.json()))
const loadMore = () => moreCache || (moreCache = fetch(url('foods-more.json'), { cache: 'force-cache' }).then(r => r.json()).then(d => d.rows.map(foodFromRow)))

function blurb(f) {
  const sv = f.u === 'g' ? f.sv?.[0] : null
  const kcal = r0(f.u === 'g' ? (sv ? f.v[0] * sv.g / 100 : f.v[0]) : f.v[0])
  return (f.u === 'g' ? (sv ? sv.l : 'per 100 g') : (f.s || '1 serving')) + ' · ' + kcal + ' kcal'
}
const Row = ({ f, onPick }) => <button className="ng-item" onClick={() => onPick(f)}>
  <span>{f.n}</span><small>{blurb(f)}{f.src ? <em className={'ng-src s' + f.src.charAt(0)}>{f.src}</em> : null}</small>
</button>

function Detail({ food, day, onBack, onClose, onEdit }) {
  const addEntry = useNutrition(s => s.addEntry)
  const saveFood = useNutrition(s => s.saveFood)
  const favorites = useNutrition(s => s.favorites)
  const toggleFavorite = useNutrition(s => s.toggleFavorite)
  const isFavorite = favorites.some(f => f.id === food.id)
  const mine = useNutrition(s => s.customFoods.some(c => c.id === food.id))
  const units = unitsFor(food)
  const d = defaultAmount(food)
  const [unitId, setUnitId] = useState(d.unit)
  const [qty, setQty] = useState(String(d.qty))
  const [time, setTime] = useState(hhmm(Date.now()))
  const [all, setAll] = useState(false)
  const unit = units.find(u => u.id === unitId) || units[0]
  const n = parseFloat(qty) || 0
  const e = entryFromUnit(food, n, unit, 0, '')
  const step = unit.id === 'g' ? 10 : 0.5
  const bump = dir => setQty(fmtQty(Math.max(0, n + dir * step)))
  const add = () => { if (n > 0) { addEntry(entryFromUnit(food, n, unit, atOf(day, time)), food); onClose() } }

  return <div className="ng-detail">
    <div className="ng-sheet-hd"><button className="iconbtn" onClick={onBack} aria-label="Back"><Icon name="chevronLeft" /></button>
      <div className="ng-title"><b>{food.n}</b>{food.src && <small>{food.src}</small>}</div>
      {food.custom ? <button className="iconbtn" onClick={() => onEdit(food)} aria-label="Edit food"><Icon name="pencil" /></button> : <span style={{ width: 36 }} />}</div>
    <div className="ng-big"><b>{r0(e.v[0])}</b><small>kcal</small></div>
    <div className="ng-macros">
      <span className="mp"><i />Protein <b>{fmt(e.v[1])} g</b></span><span className="mc"><i />Carbs <b>{fmt(e.v[2])} g</b></span><span className="mf"><i />Fat <b>{fmt(e.v[3])} g</b></span>
    </div>
    <div className="ng-amount">
      <button className="iconbtn" onClick={() => bump(-1)} aria-label="Less"><Icon name="minus" /></button>
      <input className="ng-in" inputMode="decimal" value={qty} onChange={ev => setQty(ev.target.value)} aria-label="Amount" />
      <button className="iconbtn" onClick={() => bump(1)} aria-label="More"><Icon name="plus" /></button>
      <select className="ng-in" value={unit.id} onChange={ev => { const nu = units.find(u => u.id === ev.target.value); setUnitId(nu.id); setQty(fmtQty(Math.round(n * unit.per / nu.per * 100) / 100)) }} aria-label="Serving size">
        {units.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
      </select>
    </div>
    <label className="ng-f"><span>Time</span><input className="ng-in" type="time" value={time} onChange={ev => setTime(ev.target.value)} /></label>
    <button className="ng-btn" onClick={add}>Add to diary</button>

    <button className="ng-acc" onClick={() => setAll(!all)}><span>Full nutrition for this amount</span><Icon name={all ? 'chevronUp' : 'chevronDown'} /></button>
    {all && <div className="ng-label">
      {['oth', 'vit', 'min'].map(g => {
        const rows = ORDER[g].filter(k => e.v[IDX[k]] > 0)
        return rows.length ? <div key={g}><div className="ng-sec">{GNAME[g]}</div>{rows.map(k => <div className="ng-lrow" key={k}>
          <span>{META[k].l}</span><b>{fmt(e.v[IDX[k]])} {META[k].u}</b><small>{Math.round(e.v[IDX[k]] / META[k].t * 100)}%</small></div>)}</div> : null
      })}
      <p className="ng-muted">% of a general adult daily target{food.src === 'Open Food Facts' ? '. Packaged-food labels list only some nutrients, so the rest read as zero.' : '.'}</p>
    </div>}
    <button className="ng-link" onClick={() => toggleFavorite(food)}>{isFavorite ? '★ Remove from favourites' : '☆ Add to favourites'}</button>
    {!mine && !food.custom && <button className="ng-link" onClick={() => { saveFood(food); }}>Save to My foods</button>}
    {mine && <p className="ng-muted">In My foods ✓</p>}
  </div>
}

export default function FoodSheet({ day, onClose }) {
  const customFoods = useNutrition(s => s.customFoods)
  const recentFoods = useNutrition(s => s.recentFoods)
  const favorites = useNutrition(s => s.favorites)
  const addEntry = useNutrition(s => s.addEntry)
  const saveFood = useNutrition(s => s.saveFood)
  const deleteFood = useNutrition(s => s.deleteFood)
  const [tab, setTab] = useState('search')
  const [q, setQ] = useState('')
  const [core, setCore] = useState(null)
  const [more, setMore] = useState(null)
  const [pick, setPick] = useState(null)
  const [form, setForm] = useState(null)   // null | 'new' | food
  const [online, setOnline] = useState({ s: 'idle', items: [] })
  const [note, setNote] = useState('')
  const [quick, setQuick] = useState({ name: '', k: '', p: '', c: '', f: '' })
  const [qtime, setQtime] = useState(hhmm(Date.now()))
  const token = useRef(0)

  useEffect(() => { loadCore().then(d => setCore(d.foods)).catch(() => setCore([])) }, [])
  useEffect(() => { if (q.length >= 2 && !more) loadMore().then(setMore).catch(() => setMore([])) }, [q, more])
  useEffect(() => { token.current++; setOnline({ s: 'idle', items: [] }); setNote('') }, [q])

  const results = useMemo(() => (core && q.trim() && !looksLikeBarcode(q) ? searchFoods(core, more, q, 40, customFoods) : []), [core, more, q, customFoods])

  const lookupBarcode = async code => {
    const my = ++token.current
    setNote('Looking up barcode…')
    let f = (more || (await loadMore().catch(() => [])))?.find(x => x.ean === code) || customFoods.find(x => x.ean === code)
    if (!f) { try { f = await barcodeOFF(code) } catch { if (my === token.current) return setNote('Couldn’t reach Open Food Facts. Check your connection.') } }
    if (my !== token.current) return
    if (f) { setNote(''); setPick(f) } else setNote('No product found for this barcode. You can add it as a custom food.')
  }
  useEffect(() => { if (looksLikeBarcode(q)) lookupBarcode(q.trim()) }, [q]) // eslint-disable-line react-hooks/exhaustive-deps

  const goOnline = async () => {
    const my = ++token.current
    setOnline({ s: 'loading', items: [] })
    try { const items = await searchOFF(q); if (my === token.current) setOnline({ s: 'done', items }) } catch { if (my === token.current) setOnline({ s: 'error', items: [] }) }
  }
  const scan = async () => {
    try { const c = await scanCode(); if (c?.value) setQ(String(c.value).replace(/\D/g, '') || c.value) } catch (e) { setNote(e?.message === 'unsupported' ? 'This phone can’t scan barcodes.' : 'Camera permission is needed to scan. You can also type the barcode number.') }
  }
  const addQuick = () => {
    const k = parseFloat(quick.k) || 0; if (!quick.name.trim() || !k) return
    addEntry(entryFromMacros(quick.name.trim(), k, parseFloat(quick.p) || 0, parseFloat(quick.c) || 0, parseFloat(quick.f) || 0, atOf(day, qtime), ''))
    onClose()
  }

  let body
  if (form) {
    body = <CustomFoodForm initial={form === 'new' ? null : form} onCancel={() => setForm(null)}
      onSave={f => { const saved = saveFood(f); setForm(null); setPick(saved) }}
      onDelete={f => { deleteFood(f.id); setForm(null); setPick(null) }} />
  } else if (pick) {
    body = <Detail key={pick.id} food={pick} day={day} onBack={() => setPick(null)} onClose={onClose} onEdit={f => setForm(f)} />
  } else {
    body = <>
      <div className="ng-sheet-hd"><b>Add food</b><button className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="xmark" /></button></div>
      <div className="ng-seg">{[['search', 'Search'], ['mine', 'My foods'], ['quick', 'Quick add']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'search' && <>
        <div className="ng-searchrow">
          <input className="ng-in" autoFocus placeholder="Search foods, brands or type a barcode…" value={q} onChange={e => setQ(e.target.value)} />
          {MOBILE && <button className="iconbtn ng-scan" onClick={scan} aria-label="Scan barcode"><Icon name="camera" /></button>}
        </div>
        {note && <p className="ng-muted">{note}</p>}
        <div className="ng-list">
          {!q.trim() && favorites.length > 0 && <><div className="ng-sec">Favourites · one-tap access</div>{favorites.slice(0, 8).map(f => <Row key={'fav-' + f.id} f={f} onPick={setPick} />)}</>}
          {!q.trim() && recentFoods.length > 0 && <><div className="ng-sec">Recent</div>{recentFoods.slice(0, 12).map(f => <Row key={f.id} f={f} onPick={setPick} />)}</>}
          {!q.trim() && !recentFoods.length && !favorites.length && <p className="ng-muted">{core ? core.length : '…'} built-in foods and dishes (IFCT 2017), a ~40,000-item library, and Open Food Facts online. Search by name or scan a barcode.</p>}
          {q.trim() && !looksLikeBarcode(q) && !results.length && core && <p className="ng-muted">Nothing found on this phone.</p>}
          {results.map(f => <Row key={f.id} f={f} onPick={setPick} />)}
          {q.trim().length >= 2 && !looksLikeBarcode(q) && online.s === 'idle' && <button className="ng-online" onClick={goOnline}>🌐 Search Open Food Facts for “{q.trim()}”<small>Sends your search text to openfoodfacts.org</small></button>}
          {online.s === 'loading' && <p className="ng-muted">Searching Open Food Facts…</p>}
          {online.s === 'error' && <p className="ng-err">Couldn’t reach Open Food Facts. Check your connection and try again. <button className="ng-link" onClick={goOnline}>Retry</button></p>}
          {online.s === 'done' && <><div className="ng-sec">Open Food Facts</div>{!online.items.length && <p className="ng-muted">No matching products.</p>}{online.items.map(f => <Row key={f.id} f={f} onPick={setPick} />)}</>}
        </div>
      </>}

      {tab === 'mine' && <div className="ng-list">
        <button className="ng-btn" onClick={() => setForm('new')}>+ New custom food</button>
        {!customFoods.length && <p className="ng-muted">Your own foods and the ones you star show here, with every nutrient and serving size you saved.</p>}
        {customFoods.map(f => <Row key={f.id} f={f} onPick={setPick} />)}
      </div>}

      {tab === 'quick' && <div className="ng-form">
        <input className="ng-in" placeholder="Name" value={quick.name} onChange={e => setQuick({ ...quick, name: e.target.value })} />
        <div className="ng-grid2">{[['k', 'Calories'], ['p', 'Protein g'], ['c', 'Carbs g'], ['f', 'Fat g']].map(([k, l]) =>
          <label className="ng-f" key={k}><span>{l}</span><input className="ng-in" inputMode="decimal" value={quick[k]} onChange={e => setQuick({ ...quick, [k]: e.target.value })} /></label>)}</div>
        <label className="ng-f"><span>Time</span><input className="ng-in" type="time" value={qtime} onChange={e => setQtime(e.target.value)} /></label>
        <button className="ng-btn" onClick={addQuick}>Add</button>
        <p className="ng-muted">One-off entry for this day. To reuse a food with all its nutrients, make it a custom food in My foods.</p>
      </div>}
    </>
  }
  return <div className="ng-scrim" onClick={onClose}><div className="ng-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Add food">{body}</div></div>
}
