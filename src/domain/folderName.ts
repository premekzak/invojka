/**
 * A folder name for a new business, made from its name. Keeps diacritics and spaces (they are fine on Windows, macOS
 * and OneDrive) but drops what Windows forbids, and never returns an empty or reserved name.
 */
export function folderName(name: string): string {
  const clean = name
    .replace(/[<>:"/\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '') // Windows drops trailing dots and spaces
    .slice(0, 80)
    .trim()
  if (!clean) return 'Invojka'
  return /^(con|prn|aux|nul|com\d|lpt\d)$/i.test(clean) ? `${clean} (Invojka)` : clean
}
