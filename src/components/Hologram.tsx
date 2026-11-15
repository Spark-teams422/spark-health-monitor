// 3D body hologram: a point cloud sampled from the Human Atlas / BodyParts3D 4.0 anatomy (CC BY 4.0).
// Points are white; a group lights up only in the status colour the shared layer gives it.
import { useEffect, useRef } from 'react'
import * as T from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Level } from '../core/types'

export type HoloGroup = 'skin' | 'skeleton' | 'heart' | 'lungs' | 'brain' | 'vessels' | 'abdomen'
export type HoloView = 'front' | 'side' | 'back' | 'spin'
/** `n` changes on every button press, so pressing the same view again resets the camera. */
export type ViewCmd = { id: HoloView; n: number }
interface Meta { count: number; min: number[]; max: number[]; groups: HoloGroup[] }

const BASE: Record<HoloGroup, number> = { skin: 0.1, skeleton: 0.28, heart: 0.6, lungs: 0.28, brain: 0.1, vessels: 0.3, abdomen: 0.26 }
const STATUS_RGB: Partial<Record<Level, [number, number, number]>> = { yellow: [1, 0.75, 0], red: [1, 0.3, 0.3] }
const VIEW_ANGLE: Record<HoloView, number> = { front: 0, side: Math.PI / 2, back: Math.PI, spin: 0 }

const DRAG_PX = 4 // pointer travel that counts as a drag (display only)

let cloud: Promise<{ meta: Meta; pos: Float32Array; grp: Uint8Array }> | null = null
function loadCloud() {
  cloud ??= Promise.all([fetch(`${import.meta.env.BASE_URL}hologram.json`).then((r) => r.json() as Promise<Meta>), fetch(`${import.meta.env.BASE_URL}hologram.bin`).then((r) => r.arrayBuffer())]).then(([meta, buf]) => {
    const q = new Int16Array(buf, 0, meta.count * 3)
    const pos = new Float32Array(meta.count * 3)
    const mid = [0, 1, 2].map((k) => (meta.min[k] + meta.max[k]) / 2)
    for (let i = 0; i < q.length; i++) {
      const k = i % 3
      pos[i] = meta.min[k] + ((q[i] + 32768) / 65535) * (meta.max[k] - meta.min[k]) - mid[k] // centred on the body
    }
    return { meta, pos, grp: new Uint8Array(buf, meta.count * 6, meta.count) }
  })
  return cloud
}

/** Body position (centred, metres) of the point under a click: the caller maps it to a region. */
export type Pick = { x: number; y: number; group: HoloGroup }

export function Hologram({ glow, selected, view, onPick, onFree, label }: {
  glow: Partial<Record<HoloGroup, Level>>
  selected: HoloGroup[]
  view: ViewCmd
  onPick: (p: Pick) => void
  /** called when the user starts dragging: the camera is no longer at a preset view */
  onFree?: () => void
  label: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const paintRef = useRef<(() => void) | null>(null)
  const applyView = useRef<((v: HoloView) => void) | null>(null)
  const props = useRef({ glow, selected, onPick, onFree })
  props.current = { glow, selected, onPick, onFree }

  useEffect(() => {
    const el = host.current!
    let disposed = false, frame = 0
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    el.appendChild(renderer.domElement)
    const scene = new T.Scene()
    const camera = new T.PerspectiveCamera(30, 1, 0.05, 20)
    let dist = 3.6
    camera.position.set(0, 0, dist)
    // Drag to orbit, wheel / pinch to zoom, right-drag to pan; the view buttons reset the camera.
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.minDistance = 0.8
    controls.maxDistance = 6
    controls.autoRotateSpeed = 1.2
    let goal: number | null = null // azimuth the camera glides to after a view button
    controls.addEventListener('start', () => { goal = null; props.current.onFree?.() })
    const pointSize = { value: 1.7 }
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      dist = 3.4 / Math.min(1, camera.aspect * 1.6) // whole body in frame on narrow panels
      camera.updateProjectionMatrix()
      camera.position.setLength(dist) // keep the whole body in frame after a resize
      pointSize.value = 1.5 * renderer.getPixelRatio() * Math.min(1, Math.max(0.55, h / 700)) // same density at any panel size
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()
    camera.position.set(0, 0, dist)
    applyView.current = (v: HoloView) => {
      controls.target.set(0, 0, 0)
      controls.autoRotate = v === 'spin' && !matchMedia('(prefers-reduced-motion: reduce)').matches
      camera.position.setLength(dist)
      goal = v === 'spin' ? null : VIEW_ANGLE[v]
    }

    loadCloud().then(({ meta, pos, grp }) => {
      if (disposed) return
      const geo = new T.BufferGeometry()
      geo.setAttribute('position', new T.BufferAttribute(pos, 3))
      const color = new Float32Array(meta.count * 3)
      geo.setAttribute('color', new T.BufferAttribute(color, 3))
      const mat = new T.ShaderMaterial({
        transparent: true, depthWrite: false, blending: T.AdditiveBlending, vertexColors: true,
        uniforms: { size: pointSize },
        vertexShader: 'uniform float size; varying vec3 vColor; void main(){ vColor=color; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=size*(3.0/-mv.z); gl_Position=projectionMatrix*mv; }',
        fragmentShader: 'varying vec3 vColor; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor=vec4(vColor,(0.5-d)*2.0); }',
      })
      const points = new T.Points(geo, mat)
      scene.add(points)
      const paint = () => {
        const { glow, selected } = props.current
        for (let i = 0; i < meta.count; i++) {
          const g = meta.groups[grp[i]]
          const rgb = STATUS_RGB[glow[g] ?? 'green']
          const s = selected.includes(g) ? 1.5 : 1
          const b = Math.min(1, BASE[g] * s * (rgb ? 2.4 : 1))
          color[i * 3] = (rgb ? rgb[0] : 1) * b
          color[i * 3 + 1] = (rgb ? rgb[1] : 1) * b
          color[i * 3 + 2] = (rgb ? rgb[2] : 1) * b
        }
        geo.attributes.color.needsUpdate = true
      }
      paintRef.current = paint
      paint()

      const ray = new T.Raycaster()
      ray.params.Points = { threshold: 0.012 }
      let down = { x: 0, y: 0 }
      renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY } })
      renderer.domElement.addEventListener('click', (e) => {
        if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > DRAG_PX) return // that was a drag, not a pick
        const r = renderer.domElement.getBoundingClientRect()
        ray.setFromCamera(new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
        const hit = ray.intersectObject(points)[0]
        if (hit?.index != null) props.current.onPick({ x: pos[hit.index * 3], y: pos[hit.index * 3 + 1], group: meta.groups[grp[hit.index]] })
      })
    })

    const loop = () => {
      frame = requestAnimationFrame(loop)
      if (goal !== null) {
        const sph = new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target))
        const d = Math.atan2(Math.sin(goal - sph.theta), Math.cos(goal - sph.theta))
        sph.theta += d * 0.15
        sph.phi += (Math.PI / 2 - sph.phi) * 0.15
        camera.position.setFromSpherical(sph).add(controls.target)
        if (Math.abs(d) < 0.002 && Math.abs(Math.PI / 2 - sph.phi) < 0.002) goal = null
      }
      controls.update()
      renderer.render(scene, camera)
    }
    loop()
    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      ro.disconnect()
      controls.dispose()
      scene.traverse((o) => { if (o instanceof T.Points) { o.geometry.dispose(); (o.material as T.Material).dispose() } })
      renderer.dispose()
      renderer.forceContextLoss() // free the WebGL context: switching views would otherwise pile them up
      el.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => paintRef.current?.())
  useEffect(() => applyView.current?.(view.id), [view])

  return <div ref={host} className="hologram" role="img" aria-label={label} />
}
