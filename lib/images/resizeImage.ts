const MAX_INPUT_BYTES = 2 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export class ImageValidationError extends Error {}

/**
 * Verkleinert ein vom User gewähltes Bild auf ein quadratisches WebP
 * (cover-Crop, mittig). Rein clientseitig über <canvas>, keine Abhängigkeit.
 * Wirft ImageValidationError bei falschem Typ / zu grosser Datei.
 */
export async function resizeToSquareWebp(
  file: File,
  size = 512,
): Promise<Blob> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new ImageValidationError('unsupported-type')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageValidationError('too-large')
  }

  const bitmap = await loadBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ImageValidationError('canvas-unavailable')

    const scale = Math.max(size / bitmap.width, size / bitmap.height)
    const drawW = bitmap.width * scale
    const drawH = bitmap.height * scale
    ctx.drawImage(bitmap, (size - drawW) / 2, (size - drawH) / 2, drawW, drawH)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new ImageValidationError('encode-failed')),
        'image/webp',
        0.9,
      )
    })
  } finally {
    if ('close' in bitmap) (bitmap as ImageBitmap).close()
  }
}

// Fotos (z.B. Baustellenfotos an Notizen) kommen direkt vom Handy und sind
// oft 3-15 MB gross - sie werden ohnehin verkleinert, daher nur ein grobes
// Limit gegen Speicherprobleme beim Dekodieren.
const MAX_PHOTO_INPUT_BYTES = 30 * 1024 * 1024
// HEIC/HEIF: iOS konvertiert beim Auswählen meist selbst nach JPEG; falls
// nicht, kann Safari HEIC trotzdem dekodieren (andere Browser: decode-failed).
const ACCEPTED_PHOTO_TYPES = [...ACCEPTED_TYPES, 'image/heic', 'image/heif']

/**
 * Verkleinert ein Foto auf max. `maxDimension` px an der längeren Seite,
 * OHNE Zuschnitt (anders als resizeToSquareWebp fürs Logo), und kodiert als
 * JPEG - überall unterstützt (Safari < 17 kann kein WebP-Encoding) und für
 * Fotos kompakt (typisch 200-600 KB statt mehrerer MB).
 * Wirft ImageValidationError bei falschem Typ / zu grosser / defekter Datei.
 */
export async function resizePhoto(
  file: File,
  maxDimension = 1600,
): Promise<Blob> {
  if (file.type && !ACCEPTED_PHOTO_TYPES.includes(file.type)) {
    throw new ImageValidationError('unsupported-type')
  }
  if (file.size > MAX_PHOTO_INPUT_BYTES) {
    throw new ImageValidationError('too-large')
  }

  let bitmap: ImageBitmap | HTMLImageElement
  try {
    bitmap = await loadBitmap(file)
  } catch {
    throw new ImageValidationError('decode-failed')
  }
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new ImageValidationError('canvas-unavailable')
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new ImageValidationError('encode-failed')),
        'image/jpeg',
        0.85,
      )
    })
  } finally {
    if ('close' in bitmap) (bitmap as ImageBitmap).close()
  }
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file)
  }
  // Fallback für ältere Browser
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new ImageValidationError('decode-failed'))
      img.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl)
  return res.blob()
}
