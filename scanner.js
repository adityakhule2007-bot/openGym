// Product barcode scanner for the Add food sheet (app build only). It leaves lib/scan.js, which the gym check-in uses, untouched.
// Differences from the check-in scan: only retail formats are searched (EAN-13/8, UPC-A/E), which is faster and
// avoids picking up a QR code on the pack; autoZoom helps with small barcodes; errors are named so the sheet can say why.
// ML Kit shows Google's own scanner screen, which has a torch button.
import { MOBILE } from '../mobile.js'

// Resolves to the digits of the first barcode found, or null if the person backed out.
// Throws Error('unsupported' | 'permission-denied' | 'web') for the caller to explain.
export async function scanProduct() {
  if (!MOBILE) throw new Error('web')
  const { BarcodeScanner, BarcodeFormat } = await import('@capacitor-mlkit/barcode-scanning')
  if (!(await BarcodeScanner.isSupported()).supported) throw new Error('unsupported')

  let { camera } = await BarcodeScanner.checkPermissions()
  if (camera !== 'granted' && camera !== 'limited') ({ camera } = await BarcodeScanner.requestPermissions())
  if (camera !== 'granted' && camera !== 'limited') throw new Error('permission-denied')

  // The scanner is an on-demand Google Play module on Android; install it once. A failure here is not fatal: scan() reports it.
  try {
    if (BarcodeScanner.isGoogleBarcodeScannerModuleAvailable && !(await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()).available)
      await BarcodeScanner.installGoogleBarcodeScannerModule()
  } catch { /* let scan() decide */ }

  const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE], autoZoom: true })
  const b = barcodes && barcodes[0]
  const v = b && (b.rawValue || b.displayValue)
  return v ? String(v).replace(/\D/g, '') || null : null
}
