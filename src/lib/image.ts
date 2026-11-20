/** Riduce e comprime un'immagine nel browser prima dell'upload (lato lungo max 900px, WebP). */
export async function prepareImage(file: File, maxSide = 900, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Scegli un file immagine (JPG, PNG o WebP).')
  if (file.size > 25 * 1024 * 1024) throw new Error('Immagine troppo grande: massimo 25 MB.')
  const bitmap = await loadBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/webp', quality))
  if (blob && blob.type === 'image/webp') return blob
  // alcuni browser non sanno scrivere WebP: ripiego su JPEG
  const jpg = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', quality))
  if (!jpg) throw new Error('Non riesco a leggere questa immagine.')
  return jpg
}

async function loadBitmap(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions) } catch { /* ripiego sotto */ }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally { URL.revokeObjectURL(url) }
}
