// Das Originalbild wird ohnehin verkleinert (hochgeladen wird nur das
// Ergebnis) - daher nur ein grobes Limit gegen Speicherprobleme beim
// Dekodieren, damit auch Handyfotos (3-15 MB) direkt funktionieren.
const MAX_INPUT_BYTES = 30 * 1024 * 1024
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

  let bitmap: ImageBitmap | HTMLImageElement
  try {
    bitmap = await loadBitmap(file)
  } catch {
    throw new ImageValidationError('decode-failed')
  }
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
// Jedes Bildformat, das der Browser dekodieren kann (z.B. HEIC in Safari) -
// hochgeladen wird ohnehin das neu kodierte JPEG.

/**
 * Verkleinert ein Foto auf max. `maxDimension` px an der längeren Seite,
 * OHNE Zuschnitt (anders als resizeToSquareWebp fürs Logo), und kodiert als
 * JPEG - überall unterstützt (Safari < 17 kann kein WebP-Encoding) und für
 * Fotos kompakt (typisch 200-600 KB statt mehrerer MB).
 * Scheitert das Kodieren (Speicherknappheit bei sehr grossen Handyfotos,
 * v.a. iOS), wird es mit kleinerer Kantenlänge nochmals versucht.
 * Wirft ImageValidationError bei falschem Typ / zu grosser / defekter Datei.
 */
export async function resizePhoto(
  file: File,
  maxDimension = 1600,
): Promise<Blob> {
  if (file.type && !file.type.startsWith('image/')) {
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
    for (const dimension of [maxDimension, Math.min(maxDimension, 1024)]) {
      const blob = await drawToJpeg(bitmap, dimension).catch(() => null)
      if (blob) return blob
    }
    throw new ImageValidationError('encode-failed')
  } finally {
    if ('close' in bitmap) (bitmap as ImageBitmap).close()
  }
}

function drawToJpeg(bitmap: ImageBitmap | HTMLImageElement, maxDimension: number): Promise<Blob | null> {
  const width = bitmap.width || (bitmap as HTMLImageElement).naturalWidth
  const height = bitmap.height || (bitmap as HTMLImageElement).naturalHeight
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
}

/**
 * Dekodiert das Bild - zuerst per createImageBitmap, und falls das scheitert
 * (z.B. Safari bei sehr grossen bzw. HEIC-Fotos), ueber ein <img>-Element,
 * das solche Dateien oft trotzdem laden kann.
 */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file)
    } catch {
      // weiter mit dem <img>-Fallback
    }
  }
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
