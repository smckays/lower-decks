import type { Mate, Ship, Station } from '../types'
import { VOICES, alias } from './voice'

type Node = { x: number; y: number; label: string }

const WIDTH = 1024
const HEIGHT = 762
const MONO = "'JetBrains Mono','SF Mono','Cascadia Code',Menlo,Consolas,ui-monospace,monospace"
const HUB: Station = 'mess'
const LANES = 6
const GAP = 7

const NODES: Record<Station, Node> = {
  mess: { x: 512, y: 318, label: 'CORE' },
  bridge: { x: 512, y: 84, label: 'INPUT' },
  hold: { x: 150, y: 132, label: 'MEM' },
  sensors: { x: 866, y: 118, label: 'SCAN' },
  engine: { x: 84, y: 330, label: 'EXEC' },
  comms: { x: 940, y: 330, label: 'NET' },
  workshop: { x: 196, y: 520, label: 'WRITE' },
  reactor: { x: 512, y: 526, label: 'VERIFY' },
  cryo: { x: 842, y: 516, label: 'SPAWN' },
}

const NAVY = '#0a1530'
const CYAN = '#35c8e6'
const BLUE = '#3f7df0'
const ORANGE = '#f2793a'
const DIM = '#1c3a63'
const FAULT = '#ff5a3c'

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function rng(seed: number): () => number {
  let s = seed >>> 0

  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0

    return s / 4294967296
  }
}

type Trace = { d: string; back: string; length: number }

// One lane of the bus from the core to a node: straight, a 45-degree run, straight.
function lane(to: Node, i: number): Trace {
  const hub = NODES[HUB]
  const off = (i - (LANES - 1) / 2) * GAP
  const dx = to.x - hub.x
  const dy = to.y - hub.y
  const isWide = Math.abs(dx) >= Math.abs(dy)
  const sx = isWide ? 0 : off
  const sy = isWide ? off : 0
  const diag = Math.min(Math.abs(dx), Math.abs(dy))
  const rest = Math.abs(Math.abs(dx) - Math.abs(dy))
  const lead = Math.round(rest * 0.45)
  const ux = Math.sign(dx)
  const uy = Math.sign(dy)
  const p0: [number, number] = [hub.x + sx, hub.y + sy]
  const p1: [number, number] = isWide ? [p0[0] + ux * lead, p0[1]] : [p0[0], p0[1] + uy * lead]
  const p2: [number, number] = [p1[0] + ux * diag, p1[1] + uy * diag]
  const p3: [number, number] = [to.x + sx, to.y + sy]
  const pts = [p0, p1, p2, p3].map(p => `${Math.round(p[0])} ${Math.round(p[1])}`)

  return {
    d: `M${pts.join('L')}`,
    back: `M${[...pts].reverse().join('L')}`,
    length: rest + diag * 1.414,
  }
}

function bit(path: string, dur: number, phase: number, now: number, fill: string, size: number): string {
  const begin = -(((now + phase * dur) % dur) + dur) % dur
  const h = size / 2

  return `<rect x="${-h}" y="${-h}" width="${size}" height="${size}" fill="${fill}"><animateMotion dur="${dur.toFixed(1)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite" path="${path}"/></rect>`
}

/** The board as one SVG document; `now` is seconds, so motion carries over a redraw. */
export function circuitScene(ship: Ship, now: number): string {
  const voice = VOICES.circuit
  const rand = rng(11)
  const hub = NODES[HUB]
  const isIdle = ship.alert === 'allstop'
  const lamp = ship.alert === 'breach' ? FAULT : isIdle ? '#6f8fb8' : CYAN

  const byStation = new Map<Station, Mate[]>()
  for (const m of ship.crew) {
    byStation.set(m.station, [...(byStation.get(m.station) ?? []), m])
  }

  // The board nobody asked about: dim traces on the three allowed angles, and stray digits.
  let board = ''
  let drift = ''
  for (let i = 0; i < 46; i += 1) {
    let x = Math.round(rand() * WIDTH)
    let y = Math.round(60 + rand() * 500)
    const pts = [`${x} ${y}`]
    const turns = 2 + Math.floor(rand() * 2)
    let total = 0
    for (let t = 0; t < turns; t += 1) {
      const dir = Math.floor(rand() * 8)
      const len = 50 + Math.round(rand() * 190)
      const dx = [1, 1, 0, -1, -1, -1, 0, 1][dir] ?? 0
      const dy = [0, 1, 1, 1, 0, -1, -1, -1][dir] ?? 0
      // A run that would leave the board is dropped, never bent: bending breaks the angle.
      if (x + dx * len < 8 || x + dx * len > WIDTH - 8 || y + dy * len < 56 || y + dy * len > 566) {
        continue
      }
      x += dx * len
      y += dy * len
      pts.push(`${x} ${y}`)
      total += len
    }
    const d = `M${pts.join('L')}`
    const tone = rand() < 0.14 ? '#5a3524' : rand() < 0.5 ? DIM : '#18345a'
    board += `<path d="${d}" fill="none" stroke="${tone}" stroke-width="1"/><circle cx="${x}" cy="${y}" r="2.2" fill="none" stroke="${tone}" stroke-width="1"/>`
    if (i % 2 === 0 && pts.length > 1) {
      drift += bit(d, (total / 14) * (isIdle ? 1.6 : 1), rand(), now, i % 10 === 0 ? '#a85a34' : '#3d78b0', 2.4)
    }
  }
  let digits = ''
  for (let i = 0; i < 130; i += 1) {
    digits += `<text x="${Math.round(rand() * WIDTH)}" y="${Math.round(64 + rand() * 500)}" font-size="7" fill="${rand() < 0.12 ? '#8a4a2c' : '#2c5f90'}" font-family="${MONO}">${rand() < 0.5 ? 0 : 1}</text>`
  }

  let buses = ''
  let traffic = ''
  let nodes = ''
  for (const id of Object.keys(NODES) as Station[]) {
    const n = NODES[id]
    const here = byStation.get(id) ?? []
    const busy = here.filter(m => m.isBusy)
    const isFault = ship.alert === 'breach' && ship.breachAt === id
    const isLive = busy.length > 0
    const bright = isFault ? FAULT : isLive ? CYAN : '#2a5c8f'
    if (id !== HUB) {
      for (let i = 0; i < LANES; i += 1) {
        const t = lane(n, i)
        const accent = i === 1 ? ORANGE : i % 2 === 0 ? CYAN : BLUE
        const stroke = isFault ? FAULT : isLive ? accent : i === 1 ? '#4a2f24' : '#1f4470'
        if (isLive || isFault) {
          buses += `<path d="${t.d}" fill="none" stroke="${stroke}" stroke-width="5" opacity="0.13"/>`
        }
        buses += `<path d="${t.d}" fill="none" stroke="${stroke}" stroke-width="1.3"/>`
        const count = isLive ? 4 + Math.min(4, busy.length * 2) : isIdle ? 1 : 0
        const pace = isFault ? 0.4 : isLive ? 1 : 3.4
        for (let b = 0; b < count; b += 1) {
          const fill = isFault ? '#ffd0c4' : isLive ? (i === 1 ? '#ffd2b0' : '#d6f6ff') : '#4f8fc6'
          traffic += bit(i % 2 === 0 ? t.d : t.back, (t.length / 60) * pace * (0.85 + rand() * 0.3), rand(), now, fill, isLive ? 3.4 : 2.6)
        }
      }
    }
    // The node: a small package with pads, lit while something is working there.
    const s = id === HUB ? 30 : 19
    const glow = isLive || isFault || (id === HUB && !isIdle)
      ? `<circle cx="${n.x}" cy="${n.y}" r="${s * 2.1}" fill="${bright}" opacity="0.1"><animate attributeName="opacity" values="0.05;0.16;0.05" dur="${isFault ? 0.5 : 1.8}s" repeatCount="indefinite"/></circle>`
      : ''
    let pads = ''
    for (let px = -1; px <= 1; px += 1) {
      for (let py = -1; py <= 1; py += 1) {
        pads += `<rect x="${n.x + px * (s / 2.2) - 1.5}" y="${n.y + py * (s / 2.2) - 1.5}" width="3" height="3" fill="${bright}" opacity="${isLive || isFault ? 1 : 0.6}"/>`
      }
    }
    nodes += `${glow}<rect x="${n.x - s}" y="${n.y - s}" width="${s * 2}" height="${s * 2}" rx="3" fill="${NAVY}" stroke="${bright}" stroke-width="1.4"/>${pads}`
    const tags = busy.map(m => alias('circuit', m.name)).join(' ')
    const ly = n.y > 420 ? n.y + s + 15 : n.y - s - 8
    nodes += `<text x="${n.x}" y="${id === HUB ? n.y + s + 15 : ly}" font-size="9.5" text-anchor="middle" fill="${isFault ? FAULT : isLive ? '#d6f6ff' : '#4f7fae'}" font-family="${MONO}" letter-spacing="2">${n.label}${tags === '' ? '' : '  ' + tags}</text>`
  }

  // The log: newest at the top, right under the board, older lines fading out below it.
  const shown = ship.log.slice(-8)
  const rows = shown
    .map((entry, i) => {
      const [op = '', ...rest] = entry.text.split('\t')
      const subject = alias('circuit', rest.join(' '))
      const age = shown.length - 1 - i
      const y = 614 + age * 19
      const tint = entry.kind === 'breach' ? FAULT : op === 'NOTE' ? '#c98a5e' : op === 'IDLE' || op === 'EXIT' ? '#5f86b3' : CYAN
      const seq = (entry.n ?? 0).toString(16).padStart(4, '0')
      const who = alias('circuit', entry.who).padEnd(4, ' ')

      return `<g opacity="${Math.max(0.22, 1 - age * 0.115).toFixed(2)}"><text x="30" y="${y}" fill="#2f5f92">${seq}</text><text x="84" y="${y}" fill="#4f8fc6">${esc(who)}</text><text x="138" y="${y}" fill="${tint}">${esc(op)}</text><text x="212" y="${y}" fill="#b9d3ee">${esc(subject.length > 96 ? subject.slice(0, 95) + '…' : subject)}</text></g>`
    })
    .join('')
  const log = `<g font-family="${MONO}" font-size="12.5" letter-spacing="0.3" xml:space="preserve">${rows}</g>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="${NAVY}"/>${board}${digits}${drift}${buses}${traffic}${nodes}<text x="28" y="34" font-size="11" fill="#4f7fae" font-family="${MONO}" letter-spacing="3">${esc(voice.title.toUpperCase())}</text><path d="M28 574H${WIDTH - 28}" stroke="#16305a" stroke-width="1"/><rect x="30" y="582" width="9" height="9" fill="${lamp}">${ship.alert === 'underway' ? '' : '<animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite"/>'}</rect><text x="52" y="591" font-size="12.5" fill="${lamp}" font-family="${MONO}" letter-spacing="2.5">${voice.banners[ship.alert]}</text><text x="${WIDTH - 28}" y="591" font-size="10.5" text-anchor="end" fill="#4f7fae" font-family="${MONO}" letter-spacing="1">OPS ${ship.jobs}  FAULTS ${ship.breaches}  THREADS ${ship.hires}</text>${log}</svg>`
}

export function circuitLabel(station: Station): string {
  return NODES[station].label
}

export function circuitDescribe(ship: Ship): string {
  const busy = ship.crew.filter(m => m.isBusy).map(m => `${alias('circuit', m.name)} at ${NODES[m.station].label}`)

  return `A circuit board of traces carrying bits between nodes. ${busy.length === 0 ? 'Idle.' : busy.join('; ') + '.'}`
}
