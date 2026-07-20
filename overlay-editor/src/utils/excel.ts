/** 0-based column index → Excel letter (0 = A) */
export function colIndexToLetter(index: number): string {
  let n = index + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function cellRef(colIndex: number, rowIndex1Based: number): string {
  return `${colIndexToLetter(colIndex)}${rowIndex1Based}`
}
