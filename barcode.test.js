import { describe, it, expect } from 'vitest'
import { gtinCheck, upceToUpca, classifyBarcode, barcodeProblem, looksLikeBarcode } from './barcode.js'

describe('check digit', () => {
  it('accepts real codes of every length and rejects a changed digit', () => {
    expect(gtinCheck('4006381333931')).toBe(true)     // EAN-13
    expect(gtinCheck('036000291452')).toBe(true)      // UPC-A
    expect(gtinCheck('96385074')).toBe(true)          // EAN-8
    expect(gtinCheck('10012345678902')).toBe(true)    // GTIN-14
    expect(gtinCheck('4006381333932')).toBe(false)
    expect(gtinCheck('12345')).toBe(false)
  })
  it('ignores spaces and dashes', () => { expect(gtinCheck('4006 3813-33931')).toBe(true) })
})

describe('UPC-E', () => {
  it('expands to the full UPC-A with the same check digit', () => {
    expect(upceToUpca('04252614')).toBe('042100005264')
    expect(gtinCheck('042100005264')).toBe(true)
    expect(upceToUpca('12345678')).not.toBeNull()
    expect(upceToUpca('24252614')).toBeNull()
  })
})

describe('lookup forms', () => {
  it('tries a UPC-A as EAN-13 first, because Open Food Facts stores it with a leading 0', () => {
    expect(classifyBarcode('036000291452').variants).toEqual(['0036000291452', '036000291452'])
  })
  it('tries a leading-zero EAN-13 as UPC-A too', () => {
    expect(classifyBarcode('0036000291452').variants).toEqual(['0036000291452', '036000291452'])
  })
  it('keeps an Indian EAN-13 as is', () => {
    const c = classifyBarcode('8901030895562')
    expect(c.kind).toBe('EAN-13'); expect(c.variants).toEqual(['8901030895562'])
  })
  it('offers the UPC-E expansion when the 8 digits are a valid UPC-E', () => {
    expect(classifyBarcode('04252614').variants).toEqual(['04252614', '0042100005264', '042100005264'])
  })
  it('does not invent forms for a short number', () => { expect(classifyBarcode('123').variants).toEqual([]) })
})

describe('messages for typed numbers', () => {
  it('explains what is wrong', () => {
    expect(barcodeProblem('123')).toMatch(/at least 8/)
    expect(barcodeProblem('1234567890')).toMatch(/usual barcode length/)
    expect(barcodeProblem('4006381333932')).toMatch(/last digit/)
    expect(barcodeProblem('4006381333931')).toBeNull()
  })
  it('recognises barcode-shaped text', () => { expect(looksLikeBarcode(' 8901030895562 ')).toBe(true); expect(looksLikeBarcode('dal')).toBe(false) })
})
