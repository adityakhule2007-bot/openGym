import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from '../components/Icon.jsx'
import { MOBILE } from '../lib/mobile.js'
import { importCodeFromImage } from '../lib/scan.js'
import { scanProduct } from '../lib/nutrition/scanner.js'
import { useNutrition, uid } from '../lib/nutrition/store.js'
import { searchOFF, barcodeOFF } from '../lib/nutrition/off.js'
import { classifyBarcode, barcodeProblem } from '../lib/nutrition/barcode.js'
import { ok, warn, tap } from '../lib/nutrition/haptics.js'
import { entriesFromTemplate, templateTotals, tagLabel } from '../lib/nutrition/templates.js'
import {
  META, ORDER, GNAME, IDX, hhmm, atOf, unitsFor, defaultAmount, entryFromUnit, entryFromMacros,
  searchFoods, foodFromRow, looksLikeBarcode, fmtQty,
} from '../lib/nutrition/engine.js'
import CustomFoodForm from './NutritionCustomFood.jsx'

const url = name => new URL('nutrition/' + name, document.baseURI).href
const r0 = n => Math.round(n)
const fmt = x => (x >= 10 ? String(Math.round(x)) : x >= 1 ? String(Math.round(x * 10) / 10) : String(Math.round(x * 100) / 100))
let coreCache = null, moreCache = null
const loadCore = () => coreCache || (coreCache = fetch(url('foods-core.json')).then(r => r.json()))
const loadMore = () => moreCache || (moreCache = fetch(url('foods-more.json')).then(r => r.json()).then(d => d.rows.map(foodFromRow)))

function useOnline() {
  const [on, setOn] = useState(typeof navigator === 'undefined' || navigator.onLine !== false)
  useEffect(() => {
    const up = () => setOn(true), down = () => setOn(false)
    window.addEventListener('online', up); window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])
  return on
}

function blurb(f) {
  const sv = f.u === 'g' ? f.sv?.[0] : null
  const kcal = r0(f.u === 'g' ? (sv ? f.v[0] * sv.g / 100 : f.v[0]) : f.v[0])
  return (f.u === 'g' ? (sv ? sv.l : 'per 100 g') : (f.s || '1 serving')) + ' · ' + kcal + ' kcal'
}
const Row = ({ f, onPick }) => <button className="ng-item" onClick={() => onPick(f)}>
  <span>{f.n}</span><small>{blurb(f)}{f.src ? <em className={'ng-src s' + f.src.charAt(0)}>{f.src}</em> : null}</small>
</button>

function Detail({ food, day, scanned, onBack, onClose, onEdit, onAdded, onFix }) {
  const addEntry = useNutrition(s => s.addEntry)
  const saveFood = useNutrition(s => s.saveFood)
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
  const bump = dir => { tap(); setQty(fmtQty(Math.max(0, n + dir * step))) }
  const add = () => { if (n > 0) { addEntry(entryFromUnit(food, n, unit, atOf(day, time)), food); ok(); onAdded ? onAdded(food) : onClose() } else warn() }

  return <div className="ng-detail">
    <div className="ng-sheet-hd"><button className="iconbtn" onClick={onBack} aria-label="Back"><Icon name="chevronLeft" /></button>
      <div className="ng-title"><b>{food.n}</b>{food.src && <small>{food.src}{scanned && food.ean ? ' · ' + food.ean : ''}</small>}</div>
      {food.custom ? <button className="iconbtn" onClick={() => onEdit(food)} aria-label="Edit food"><Icon name="pencil" /></button> : <span style={{ width: 36 }} />}</div>
    {food.partial && <div className="ng-warnbox"><b>Check this against the pack</b>
      <p>Open Food Facts has only some of this label{food.v[0] > 0 && food.v[1] + food.v[2] + food.v[3] === 0 ? ' (calories but no protein, carbs or fat)' : ' (calories were worked out from the macros)'}. Fix the numbers once and every later scan uses yours.</p>
      <button className="ng-link" onClick={() => onFix(food)}>Fix and save to My foods</button></div>}
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
    {!mine && !food.custom && <button className="ng-link" onClick={() => { saveFood(food); tap() }}>★ Save to My foods</button>}
    {mine && <p className="ng-muted">In My foods ✓</p>}
  </div>
}

// Saved meals and day templates: tap Add to log all of it on the day being viewed, at the times it was saved with.
function MealsTab({ day, onClose }) {
  const templates = useNutrition(s => s.templates)
  const addEntries = useNutrition(s => s.addEntries)
  const touch = useNutrition(s => s.touchTemplate)
  const del = useNutrition(s => s.deleteTemplate)
  const [sure, setSure] = useState(null)
  if (!templates.length) return <div className="ng-list"><p className="ng-muted">Save a meal or a whole day from the Diary (the star on a meal, or “Save day”) and it shows here for one-tap logging. Tag it as a training day or a rest day and the Diary will suggest it.</p></div>
  return <div className="ng-list">
    {templates.map(t => {
      const tot = templateTotals(t)
      return <div className="ng-tpl" key={t.id}>
        <div><span>{t.name}</span><small>{t.items.length} item{t.items.length === 1 ? '' : 's'} · {r0(tot[0])} kcal · {r0(tot[1])}P {r0(tot[2])}C {r0(tot[3])}F<em className="ng-src">{tagLabel(t.tag)}</em></small></div>
        <div className="ng-row">
          <button className="ng-chip" onClick={() => { addEntries(entriesFromTemplate(t, day, uid)); touch(t.id); ok(); onClose() }}>Add</button>
          {sure === t.id ? <button className="ng-chip ghost" onClick={() => { del(t.id); setSure(null); tap() }}>Delete?</button>
            : <button className="iconbtn" onClick={() => setSure(t.id)} aria-label={'Delete ' + t.name}><Icon name="trash" /></button>}
        </div>
      </div>
    })}
  </div>
}

export default function FoodSheet({ day, onClose, startTab = 'search', startScan = false }) {
  const customFoods = useNutrition(s => s.customFoods)
  const recentFoods = useNutrition(s => s.recentFoods)
  const addEntry = useNutrition(s => s.addEntry)
  const saveFood = useNutrition(s => s.saveFood)
  const deleteFood = useNutrition(s => s.deleteFood)
  const online = useOnline()
  const [tab, setTab] = useState(startTab)
  const [q, setQ] = useState('')
  const [core, setCore] = useState(null)
  const [more, setMore] = useState(null)
  const [pick, setPick] = useState(null)
  const [scanned, setScanned] = useState(false)
  const [added, setAdded] = useState(null)
  const [form, setForm] = useState(null)   // null | 'new' | food | { n, brand, ean, sv } draft
  const [web, setWeb] = useState({ s: 'idle', items: [], from: '', t: 0, stale: false })
  const [bc, setBc] = useState({ s: 'idle', msg: '', draft: null, code: '' })
  const [force, setForce] = useState(false)
  const [quick, setQuick] = useState({ name: '', k: '', p: '', c: '', f: '' })
  const [qtime, setQtime] = useState(hhmm(Date.now()))
  const token = useRef(0)
  const photoIn = useRef(null)

  useEffect(() => { loadCore().then(d => setCore(d.foods)).catch(() => setCore([])) }, [])
  useEffect(() => { if (q.length >= 2 && !more) loadMore().then(setMore).catch(() => setMore([])) }, [q, more])
  useEffect(() => { token.current++; setWeb({ s: 'idle', items: [], from: '', t: 0, stale: false }); setBc({ s: 'idle', msg: '', draft: null, code: '' }); setForce(false) }, [q])
  useEffect(() => { if (startScan && MOBILE) scan() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => (core && q.trim() && !looksLikeBarcode(q) ? searchFoods(core, more, q, 40, customFoods) : []), [core, more, q, customFoods])

  // Barcode lookup order: My foods (a supplement you saved once), the built-in library, the on-phone cache, then Open Food Facts.
  const lookupBarcode = async code => {
    const my = ++token.current
    const { variants } = classifyBarcode(code)
    setBc({ s: 'loading', msg: '', draft: null, code })
    const mine = customFoods.find(x => x.ean && variants.includes(String(x.ean)))
    if (mine) { setBc({ s: 'idle', msg: '', draft: null, code }); setScanned(true); return setPick(mine) }
    const lib = more || (await loadMore().catch(() => []))
    const hit = lib?.find(x => x.ean && variants.includes(String(x.ean)))
    if (my !== token.current) return
    if (hit) { setBc({ s: 'idle', msg: '', draft: null, code }); setScanned(true); return setPick(hit) }
    try {
      const r = await barcodeOFF(code)
      if (my !== token.current) return
      if (r.food) { setBc({ s: 'idle', msg: '', draft: null, code }); setScanned(true); return setPick(r.food) }
      const draft = r.draft || { n: '', brand: '', ean: variants[0], sv: [] }
      setBc(r.found
        ? { s: 'nonutrition', msg: 'Open Food Facts lists this product but has no nutrition for it. Supplements are often like this. Type the numbers from the pack once and every later scan will find it instantly.', draft, code }
        : { s: 'notfound', msg: 'This barcode is not in Open Food Facts or the built-in library. Type the numbers from the pack once and every later scan will find it instantly.', draft, code })
    } catch {
      if (my !== token.current) return
      setBc({ s: 'network', msg: online ? 'Could not reach Open Food Facts. Check your connection and try again.' : 'You are offline. Products you have looked up before, My foods and built-in foods still work.', draft: { n: '', brand: '', ean: variants[0], sv: [] }, code })
    }
  }
  useEffect(() => {
    if (!looksLikeBarcode(q)) return
    const problem = barcodeProblem(q)
    if (problem && !force) { setBc({ s: 'problem', msg: problem, draft: null, code: q.trim() }); warn(); return }
    lookupBarcode(q.trim())
  }, [q, force]) // eslint-disable-line react-hooks/exhaustive-deps

  const goOnline = async (refresh = false) => {
    const my = ++token.current
    setWeb({ s: 'loading', items: [], from: '', t: 0, stale: false })
    try { const r = await searchOFF(q, 24, { refresh }); if (my === token.current) setWeb({ s: 'done', ...r }) } catch { if (my === token.current) setWeb({ s: 'error', items: [], from: '', t: 0, stale: false }) }
  }
  const scanMsg = e => ({ unsupported: 'This phone can’t scan barcodes. Type the number or use a photo.', 'permission-denied': 'Camera permission is needed to scan. You can type the number or use a photo of the barcode.', web: 'Scanning needs the app. Type the number or use a photo of the barcode.' }[e?.message] || 'The scanner could not start. Type the number or use a photo of the barcode.')
  const scan = async () => {
    try { const c = await scanProduct(); if (c) { tap(); setQ(c) } } catch (e) { setBc({ s: 'network', msg: scanMsg(e), draft: null, code: '' }) }
  }
  // A still photo of the barcode: helps with curved tubs and glare, where live scanning struggles.
  const fromPhoto = async ev => {
    const file = ev.target.files?.[0]; ev.target.value = ''
    if (!file) return
    setBc({ s: 'loading', msg: '', draft: null, code: '' })
    try {
      const c = await importCodeFromImage(file)
      const digits = c?.value ? String(c.value).replace(/\D/g, '') : ''
      if (digits) setQ(digits); else { warn(); setBc({ s: 'network', msg: 'No barcode found in that photo. Try again closer, flat on, and without glare, or type the number.', draft: null, code: '' }) }
    } catch { warn(); setBc({ s: 'network', msg: 'Could not read that photo. Try again or type the number.', draft: null, code: '' }) }
  }
  const addQuick = () => {
    const k = parseFloat(quick.k) || 0; if (!quick.name.trim() || !k) return warn()
    addEntry(entryFromMacros(quick.name.trim(), k, parseFloat(quick.p) || 0, parseFloat(quick.c) || 0, parseFloat(quick.f) || 0, atOf(day, qtime), ''))
    ok(); onClose()
  }
  const reset = () => { setPick(null); setAdded(null); setScanned(false); setQ('') }

  let body
  if (form) {
    body = <CustomFoodForm initial={form === 'new' ? null : form} onCancel={() => setForm(null)}
      onSave={f => { const saved = saveFood(f); ok(); setForm(null); setBc({ s: 'idle', msg: '', draft: null, code: '' }); setScanned(!!saved.ean); setPick(saved) }}
      onDelete={f => { deleteFood(f.id); setForm(null); setPick(null) }} />
  } else if (added) {
    body = <div className="ng-detail ng-added">
      <div className="ng-check"><Icon name="check" /></div>
      <b>Added {added.n}</b>
      <p className="ng-muted">It is in your diary for this day.</p>
      {MOBILE && <button className="ng-btn" onClick={() => { reset(); scan() }}>Scan next item</button>}
      <button className={'ng-btn' + (MOBILE ? ' ghost' : '')} onClick={reset}>Add another food</button>
      <button className="ng-link" onClick={onClose}>Done</button>
    </div>
  } else if (pick) {
    body = <Detail key={pick.id} food={pick} day={day} scanned={scanned} onBack={() => { setPick(null); setScanned(false) }} onClose={onClose}
      onEdit={f => setForm(f)} onFix={f => setForm(f)} onAdded={scanned ? f => setAdded(f) : null} />
  } else {
    body = <>
      <div className="ng-sheet-hd"><b>Add food</b><button className="iconbtn" onClick={onClose} aria-label="Close"><Icon name="xmark" /></button></div>
      {!online && <p className="ng-offline">You are offline. Built-in foods, My foods, saved meals and products you have looked up before still work.</p>}
      <div className="ng-seg">{[['search', 'Search'], ['mine', 'My foods'], ['meals', 'Meals'], ['quick', 'Quick']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => { tap(); setTab(k) }}>{l}</button>)}</div>

      {tab === 'search' && <>
        <div className="ng-searchrow">
          <input className="ng-in" autoFocus={!startScan} inputMode="search" placeholder="Search foods, brands or type a barcode…" value={q} onChange={e => setQ(e.target.value)} />
          {MOBILE && <button className="iconbtn ng-scan" onClick={scan} aria-label="Scan barcode"><Icon name="camera" /></button>}
          <button className="iconbtn ng-scan" onClick={() => photoIn.current?.click()} aria-label="Read a barcode from a photo"><Icon name="image" /></button>
          <input ref={photoIn} type="file" accept="image/*" hidden onChange={fromPhoto} />
        </div>
        {bc.s === 'loading' && <p className="ng-muted">Looking up barcode…</p>}
        {bc.msg && bc.s !== 'loading' && <div className={bc.s === 'problem' ? 'ng-warnbox' : 'ng-notebox'}>
          <p>{bc.msg}</p>
          {bc.s === 'problem' && <button className="ng-link" onClick={() => setForce(true)}>Look it up anyway</button>}
          {bc.s === 'network' && bc.code && <button className="ng-link" onClick={() => lookupBarcode(bc.code)}>Try again</button>}
          {bc.draft && (bc.s === 'notfound' || bc.s === 'nonutrition' || bc.s === 'network') && bc.draft.ean && <button className="ng-btn" onClick={() => setForm(bc.draft)}>Add it as a custom food</button>}
        </div>}
        <div className="ng-list">
          {!q.trim() && recentFoods.length > 0 && <><div className="ng-sec">Recent</div>{recentFoods.slice(0, 12).map(f => <Row key={f.id} f={f} onPick={x => { setScanned(false); setPick(x) }} />)}</>}
          {!q.trim() && !recentFoods.length && <p className="ng-muted">{core ? core.length : '…'} built-in foods and dishes (IFCT 2017), a ~40,000-item library, and Open Food Facts online. Search by name, scan a barcode, or read one from a photo.</p>}
          {q.trim() && !looksLikeBarcode(q) && !results.length && core && <p className="ng-muted">Nothing found on this phone.</p>}
          {results.map(f => <Row key={f.id} f={f} onPick={x => { setScanned(false); setPick(x) }} />)}
          {q.trim().length >= 2 && !looksLikeBarcode(q) && web.s === 'idle' && online && <button className="ng-online" onClick={() => goOnline(false)}>🌐 Search Open Food Facts for “{q.trim()}”<small>Sends your search text to openfoodfacts.org. Results are saved on this phone for offline use.</small></button>}
          {q.trim().length >= 2 && !looksLikeBarcode(q) && web.s === 'idle' && !online && <button className="ng-online" onClick={() => goOnline(false)}>Show saved Open Food Facts results for “{q.trim()}”<small>You are offline, so only searches you made before can show.</small></button>}
          {web.s === 'loading' && <p className="ng-muted">Searching Open Food Facts…</p>}
          {web.s === 'error' && <p className="ng-err">{online ? 'Couldn’t reach Open Food Facts, and there is no saved result for this search.' : 'You are offline and this search has not been saved before.'} <button className="ng-link" onClick={() => goOnline(false)}>Retry</button></p>}
          {web.s === 'done' && <><div className="ng-sec">Open Food Facts{web.from === 'cache' ? ' · saved' : ''}</div>
            {web.stale && <p className="ng-muted">Couldn’t reach Open Food Facts, so these are the results saved on {new Date(web.t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}.</p>}
            {!web.items.length && <p className="ng-muted">No matching products.</p>}{web.items.map(f => <Row key={f.id} f={f} onPick={x => { setScanned(false); setPick(x) }} />)}
            {web.from === 'cache' && online && <button className="ng-link" onClick={() => goOnline(true)}>Refresh from Open Food Facts</button>}</>}
        </div>
      </>}

      {tab === 'mine' && <div className="ng-list">
        <button className="ng-btn" onClick={() => setForm('new')}>+ New custom food</button>
        {!customFoods.length && <p className="ng-muted">Your own foods and the ones you star show here, with every nutrient and serving size you saved. A food saved with its barcode is found again when you scan it.</p>}
        {customFoods.map(f => <Row key={f.id} f={f} onPick={x => { setScanned(false); setPick(x) }} />)}
      </div>}

      {tab === 'meals' && <MealsTab day={day} onClose={onClose} />}

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
