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
