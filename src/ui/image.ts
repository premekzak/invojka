/**
 * A picture the user chose (a logo, a stamp) shrunk to fit `maxW` × `maxH` pixels and turned into a PNG data URL,
 * so it can live in settings.json and the PDF draws it without reading another file. Transparency is kept.
 */
export async function shrinkImage(file: File, maxW: number, maxH: number): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('image'))
      i.src = url
    })
    const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}
