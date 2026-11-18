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

// One lane of the bus from the core to a node. Every bus turns four times: a long diagonal is
// taken in two halves, and a bus that would run dead straight is given a jog out and back.
function lane(to: Node, i: number): Trace {
  const hub = NODES[HUB]
  const off = (i - (LANES - 1) / 2) * GAP
  const dx = to.x - hub.x
  const dy = to.y - hub.y
  const isWide = Math.abs(dx) >= Math.abs(dy)
  const main = isWide ? Math.abs(dx) : Math.abs(dy)
  const cross = isWide ? Math.abs(dy) : Math.abs(dx)
  const um = Math.sign(isWide ? dx : dy)
  const uc = Math.sign(isWide ? dy : dx) || (to.x + to.y > 600 ? 1 : -1)
  // Each step: how far along the bus's own axis, and how far across it.
  const jog = 34
  const steps: [number, number][] =
    cross >= 40
      ? [
          [(main - cross) * 0.2, 0],
          [cross * 0.5, cross * 0.5],
          [(main - cross) * 0.42, 0],
          [cross * 0.5, cross * 0.5],
          [(main - cross) * 0.38, 0],
        ]
      : [
          [(main - 2 * jog + cross) * 0.28, 0],
          [jog, jog],
          [(main - 2 * jog + cross) * 0.36, 0],
          [jog - cross, -(jog - cross)],
          [(main - 2 * jog + cross) * 0.36, 0],
        ]
  let x = hub.x + (isWide ? 0 : off)
  let y = hub.y + (isWide ? off : 0)
  const pts = [`${Math.round(x)} ${Math.round(y)}`]
  let length = 0
  for (const [along, across] of steps) {
    x += isWide ? um * along : uc * across
    y += isWide ? uc * across : um * along
    length += Math.hypot(along, across)
    pts.push(`${Math.round(x)} ${Math.round(y)}`)
  }

  return { d: `M${pts.join('L')}`, back: `M${[...pts].reverse().join('L')}`, length }
}

// A bit is a square; a packet is a dash that turns with the trace.
function bit(path: string, dur: number, phase: number, now: number, fill: string, size: number, isPacket = false): string {
  const begin = -(((now + phase * dur) % dur) + dur) % dur
  const h = size / 2
  const shape = isPacket ? `x="-5" y="-1.2" width="10" height="2.4" rx="1.2"` : `x="${-h}" y="${-h}" width="${size}" height="${size}"`

  return `<rect ${shape} fill="${fill}"><animateMotion dur="${dur.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite"${isPacket ? ' rotate="auto"' : ''} path="${path}"/></rect>`
}

// A run of light sliding along a trace.
function flow(path: string, stroke: string, length: number, speed: number, phase: number, now: number): string {
  const gap = Math.max(120, Math.round(length * 0.6))
  const dur = (gap + 26) / speed
  const begin = -(((now + phase * dur) % dur) + dur) % dur

  return `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="26 ${gap}"><animate attributeName="stroke-dashoffset" values="${gap + 26};0" dur="${dur.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite"/></path>`
}

/** The board as one SVG document; `now` is seconds, so motion carries over a redraw. */
export function circuitScene(ship: Ship, now: number): string {
  // The engine draws at most 131,072 characters: when every bus is live, thin the traffic.
  for (const density of [1, 0.7, 0.45]) {
    const drawn = draw(ship, now, density)
    if (drawn.length <= 122000) {
      return drawn
    }
  }

  return draw(ship, now, 0.25)
}

function draw(ship: Ship, now: number, density: number): string {
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
  for (let i = 0; i < 64; i += 1) {
    let x = Math.round(rand() * WIDTH)
    let y = Math.round(60 + rand() * 500)
    const pts = [`${x} ${y}`]
    const turns = 3 + Math.floor(rand() * 3)
    let total = 0
    let dir = Math.floor(rand() * 8)
    for (let t = 0; t < turns; t += 1) {
      // Each turn is 45 degrees one way or the other, so no run doubles back on itself.
      dir = (dir + (rand() < 0.5 ? 1 : 7)) % 8
      const len = 36 + Math.round(rand() * 150)
      const dx = [1, 1, 0, -1, -1, -1, 0, 1][dir] ?? 0
      const dy = [0, 1, 1, 1, 0, -1, -1, -1][dir] ?? 0
      // A run that would leave the board is dropped, never bent: bending breaks the angle.
      if (x + dx * len < 8 || x + dx * len > WIDTH - 8 || y + dy * len < 56 || y + dy * len > 566) {
        continue
      }
      x += dx * len
      y += dy * len
      pts.push(`${x} ${y}`)
      total += len * (dx !== 0 && dy !== 0 ? 1.414 : 1)
    }
    if (pts.length < 2) {
      continue
    }
    const d = `M${pts.join('L')}`
    const isWarm = rand() < 0.14
    const tone = isWarm ? '#5a3524' : rand() < 0.5 ? DIM : '#18345a'
    board += `<path d="${d}" fill="none" stroke="${tone}" stroke-width="1"/><circle cx="${x}" cy="${y}" r="2.2" fill="none" stroke="${tone}" stroke-width="1"/>`
    const speed = (isIdle ? 55 : 95) * (0.7 + rand() * 0.8)
    drift += bit(d, total / speed, rand(), now, isWarm ? '#c06a3c' : '#4a8cc8', 2.6, i % 3 === 0)
    if (i % 2 === 0 && density >= 0.7) {
      drift += flow(d, isWarm ? '#8a4a2c' : '#2f6aa8', total, speed * 1.5, rand(), now)
    }
  }
  let digits = ''
  for (let i = 0; i < Math.round(120 * density); i += 1) {
    const blink = i % 4 === 0 ? `<animate attributeName="opacity" values="1;0.15;1" dur="${(0.8 + rand() * 2.4).toFixed(1)}s" begin="${(-rand() * 3).toFixed(1)}s" repeatCount="indefinite"/>` : ''
    digits += `<text x="${Math.round(rand() * WIDTH)}" y="${Math.round(64 + rand() * 500)}" font-size="7" fill="${rand() < 0.12 ? '#8a4a2c' : '#2c5f90'}" font-family="${MONO}">${rand() < 0.5 ? 0 : 1}${blink}</text>`
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
        const count = Math.max(1, Math.round((isFault ? 7 : isLive ? 5 + Math.min(3, busy.length) : 2) * density))
        const speed = isFault ? 420 : isLive ? 230 : isIdle ? 70 : 110
        for (let b = 0; b < count; b += 1) {
          const fill = isFault ? '#ffd0c4' : isLive ? (i === 1 ? '#ffd2b0' : '#d6f6ff') : '#4f8fc6'
          traffic += bit(i % 2 === 0 ? t.d : t.back, t.length / (speed * (0.8 + rand() * 0.4)), rand(), now, fill, isLive ? 3.4 : 2.6, b % 3 === 2)
        }
        if (isLive || isFault ? density >= 0.45 || i % 2 === 0 : i % 3 === 0 && density >= 0.7) {
          traffic += flow(i % 2 === 0 ? t.d : t.back, isFault ? '#ff9c86' : isLive ? '#9fe8fb' : '#3b76b4', t.length, speed * 1.3, rand(), now)
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
        const blink = isLive || isFault ? `<animate attributeName="opacity" values="1;0.2;1" dur="${(0.3 + rand() * 0.7).toFixed(2)}s" begin="${(-rand()).toFixed(2)}s" repeatCount="indefinite"/>` : ''
        pads += `<rect x="${n.x + px * (s / 2.2) - 1.5}" y="${n.y + py * (s / 2.2) - 1.5}" width="3" height="3" fill="${bright}" opacity="${isLive || isFault ? 1 : 0.6}">${blink}</rect>`
      }
    }
    const ring = id === HUB ? `<rect x="${n.x - s - 7}" y="${n.y - s - 7}" width="${s * 2 + 14}" height="${s * 2 + 14}" rx="5" fill="none" stroke="${isIdle ? '#2a5c8f' : CYAN}" stroke-width="1.2" stroke-dasharray="10 14"><animate attributeName="stroke-dashoffset" values="24;0" dur="${isIdle ? 1.6 : 0.5}s" repeatCount="indefinite"/></rect>` : ''
    nodes += `${glow}${ring}<rect x="${n.x - s}" y="${n.y - s}" width="${s * 2}" height="${s * 2}" rx="3" fill="${NAVY}" stroke="${bright}" stroke-width="1.4"/>${pads}`
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
