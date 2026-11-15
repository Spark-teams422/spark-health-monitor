// Builds the light point-cloud hologram (public/hologram.bin + public/hologram.json) from the
// Human Atlas geometry (BodyParts3D 4.0, CC BY 4.0, https://github.com/ashemag/human-atlas).
// Usage: download public/models/atlas.json and body-*.bin.gz from that repository into one folder, then
//   node scripts/build_hologram.mjs <folder>
// Points are sampled on triangle surfaces, area-weighted, with a fixed seed, so the output is repeatable.
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { join } from 'node:path'

const dir = process.argv[2]
if (!dir) throw new Error('usage: node scripts/build_hologram.mjs <folder with atlas.json and body-*.bin.gz>')
const atlas = JSON.parse(readFileSync(join(dir, 'atlas.json'), 'utf8'))

// Group order is the index stored per point; the viewer maps groups to body regions.
const BRAIN = /cerebr|cerebell|brain|gyrus|lobe|pons|medulla oblongata|thalam|hypothal|corpus callosum|hippocamp|fornix|insula|cortex/i
const GROUPS = [
  { id: 'skin', points: 26000, match: (p) => p.system === 'integumentary' && p.name === 'Skin' },
  { id: 'skeleton', points: 22000, match: (p) => p.system === 'skeletal' },
  { id: 'heart', points: 5000, match: (p) => p.system === 'cardiac' },
  { id: 'lungs', points: 7000, match: (p) => p.system === 'respiratory' },
  { id: 'brain', points: 6000, match: (p) => p.system === 'nervous' && BRAIN.test(p.name) && !/artery|vein/i.test(p.name) },
  { id: 'vessels', points: 9000, match: (p) => p.system === 'arterial' || p.system === 'venous' },
  { id: 'abdomen', points: 6000, match: (p) => p.system === 'digestive' || p.system === 'urinary' },
]

let seed = 42
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296)

const chunks = atlas.chunks.map((c, i) => {
  const buf = gunzipSync(readFileSync(join(dir, `body-${i}.bin.gz`)))
  if (buf.byteLength !== c.bytes) throw new Error(`body-${i}: expected ${c.bytes} bytes, got ${buf.byteLength}`)
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
})

const out = []
GROUPS.forEach((g, gi) => {
  const tris = [] // [ax,ay,az,bx,by,bz,cx,cy,cz, cumulativeArea]
  let total = 0
  for (const p of atlas.parts.filter(g.match)) {
    const pos = new Float32Array(chunks[p.chunk], p.positions, p.vertexCount * 3)
    const idx = new Uint32Array(chunks[p.chunk], p.indices, p.indexCount)
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2]
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2]
      const area = 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
      total += area
      tris.push([pos[a], pos[a + 1], pos[a + 2], pos[b], pos[b + 1], pos[b + 2], pos[c], pos[c + 1], pos[c + 2], total])
    }
  }
  if (!tris.length) throw new Error(`group ${g.id} matched no parts`)
  for (let n = 0; n < g.points; n++) {
    const r = rand() * total
    let lo = 0, hi = tris.length - 1
    while (lo < hi) { const mid = (lo + hi) >> 1; if (tris[mid][9] < r) lo = mid + 1; else hi = mid }
    const t = tris[lo]
    let s = rand(), u = rand()
    if (s + u > 1) { s = 1 - s; u = 1 - u }
    out.push([t[0] + s * (t[3] - t[0]) + u * (t[6] - t[0]), t[1] + s * (t[4] - t[1]) + u * (t[7] - t[1]), t[2] + s * (t[5] - t[2]) + u * (t[8] - t[2]), gi])
  }
  console.log(`${g.id}: ${tris.length} triangles → ${g.points} points`)
})

// Quantise to int16 inside the bounding box: 6 bytes per point + 1 byte group.
const min = [0, 1, 2].map((k) => Math.min(...out.map((p) => p[k])))
const max = [0, 1, 2].map((k) => Math.max(...out.map((p) => p[k])))
const xyz = new Int16Array(out.length * 3)
const grp = new Uint8Array(out.length)
out.forEach((p, i) => {
  for (let k = 0; k < 3; k++) xyz[i * 3 + k] = Math.round(((p[k] - min[k]) / (max[k] - min[k])) * 65535 - 32768)
  grp[i] = p[3]
})
writeFileSync('public/hologram.bin', Buffer.concat([Buffer.from(xyz.buffer), Buffer.from(grp.buffer)]))
writeFileSync('public/hologram.json', JSON.stringify({
  source: 'BodyParts3D 4.0 (CC BY 4.0) via Human Atlas (MIT), sampled to a point cloud by scripts/build_hologram.mjs',
  count: out.length, min, max, groups: GROUPS.map((g) => g.id),
}, null, 1) + '\n')
console.log(`wrote ${out.length} points`)
