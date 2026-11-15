/** Move labels that share a column apart vertically so their text never overlaps (keeps order, stays inside lo..hi). */
export function spread<T extends { y: number }>(labels: T[], gap = 13, lo = -Infinity, hi = Infinity): (T & { y: number })[] {
  const out = [...labels].sort((a, b) => a.y - b.y).map((l) => ({ ...l, y: Math.min(hi, Math.max(lo, l.y)) }))
  for (let i = 1; i < out.length; i++) out[i].y = Math.max(out[i].y, out[i - 1].y + gap)
  const over = out.length ? out[out.length - 1].y - hi : 0
  if (over > 0) {
    out[out.length - 1].y = hi
    for (let i = out.length - 2; i >= 0; i--) out[i].y = Math.min(out[i].y, out[i + 1].y - gap)
  }
  return out
}
