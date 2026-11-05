// A tiny IndexedDB key-value wrapper for the two things too big for localStorage:
// meal photos ('photos', Blobs) and the offline Open Food Facts cache ('cache', plain objects).
// Everything stays inside the app's own WebView storage on the phone. Calls reject when IndexedDB is
// missing or blocked (private window, some test runners); callers treat that as "no cache" and carry on.
const DB = 'opengym-nutrition'
const STORES = ['photos', 'cache']
let dbp = null

function open() {
  if (dbp) return dbp
  dbp = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('no-idb'))
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => { for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s) }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('idb-open'))
    req.onblocked = () => reject(new Error('idb-blocked'))
  }).catch(e => { dbp = null; throw e })
  return dbp
}

const run = (store, mode, fn) => open().then(db => new Promise((resolve, reject) => {
  const tx = db.transaction(store, mode)
  const req = fn(tx.objectStore(store))
  tx.oncomplete = () => resolve(req ? req.result : undefined)
  tx.onerror = tx.onabort = () => reject(tx.error || new Error('idb-tx'))
}))

export const idb = {
  get: (store, key) => run(store, 'readonly', o => o.get(key)),
  put: (store, key, value) => run(store, 'readwrite', o => o.put(value, key)),
  del: (store, key) => run(store, 'readwrite', o => o.delete(key)),
  keys: store => run(store, 'readonly', o => o.getAllKeys()),
  clear: store => run(store, 'readwrite', o => o.clear()),
}
