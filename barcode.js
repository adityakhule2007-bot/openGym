// Barcode helpers for food lookup. Pure functions.
// Retail barcodes are GTINs: EAN-13 (most of the world, India included), UPC-A (12), EAN-8 (8), UPC-E (8, compressed UPC-A),
// and GTIN-14 on cartons. The last digit is a check digit, so a mistyped or half-scanned number can be caught before any lookup.
// Open Food Facts stores UPC-A codes with a leading 0 (as EAN-13), so a 12-digit code is also tried as 13 digits.

export const digits = s => String(s ?? '').replace(/\D/g, '')

// GS1 check digit: from the right of the body, weights 3,1,3,1...; the check digit tops the sum up to a multiple of 10.
export function gtinCheck(code) {
  const d = digits(code)
  if (![8, 12, 13, 14].includes(d.length)) return false
  let sum = 0, w = 3
  for (let i = d.length - 2; i >= 0; i--, w = 4 - w) sum += Number(d[i]) * w
  return (10 - (sum % 10)) % 10 === Number(d[d.length - 1])
}

// UPC-E (8 digits: number system 0/1, six data digits X1..X6, check digit) back to its 12-digit UPC-A.
export function upceToUpca(code) {
  const d = digits(code)
  if (d.length !== 8 || (d[0] !== '0' && d[0] !== '1')) return null
  const [ns, x1, x2, x3, x4, x5, x6, chk] = d
  let body
  if ('012'.includes(x6)) body = ns + x1 + x2 + x6 + '0000' + x3 + x4 + x5
  else if (x6 === '3') body = ns + x1 + x2 + x3 + '00000' + x4 + x5
  else if (x6 === '4') body = ns + x1 + x2 + x3 + x4 + '00000' + x5
  else body = ns + x1 + x2 + x3 + x4 + x5 + '0000' + x6
  return body + chk
}

// What a scanned or typed number is, and every form worth looking up, best first.
export function classifyBarcode(raw) {
  const d = digits(raw)
  const ok = gtinCheck(d)
  const kind = d.length === 13 ? 'EAN-13' : d.length === 12 ? 'UPC-A' : d.length === 14 ? 'GTIN-14' : d.length === 8 ? 'EAN-8' : 'unknown'
  const variants = []
  const add = x => { if (x && !variants.includes(x)) variants.push(x) }
  if (d.length === 12) { add('0' + d); add(d) }
  else if (d.length === 13) { add(d); if (d[0] === '0') add(d.slice(1)) }
  else if (d.length === 14) { add(d); add(d.slice(1)) }
  else if (d.length === 8) {
    add(d)
    const a = upceToUpca(d)
    if (a && gtinCheck(a)) { add('0' + a); add(a) }
  }
  return { digits: d, valid: ok, kind, variants: ok || d.length >= 8 ? variants : [] }
}
export const looksLikeBarcode = s => /^\d{8,14}$/.test(String(s).trim())

// A message for a number that is not a valid barcode (null when it is fine).
export function barcodeProblem(raw) {
  const d = digits(raw)
  if (d.length < 8) return 'A barcode has at least 8 digits.'
  if (d.length > 14 || [9, 10, 11].includes(d.length)) return 'That is not a usual barcode length (8, 12, 13 or 14 digits).'
  if (!gtinCheck(d)) return 'The last digit does not match, so a digit is probably wrong. Check the number on the pack.'
  return null
}
