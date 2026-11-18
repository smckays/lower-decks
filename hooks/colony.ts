import type { Mate, Ship, Station } from '../types'
import { VOICES, alias } from './voice'

type Chamber = { x: number; y: number; rx: number; ry: number; label: string; bend: number }

const WIDTH = 1024
const HEIGHT = 640
const HUB: Station = 'mess'

// An ant farm seen in section: every chamber hangs off the commons.
const CHAMBERS: Record<Station, Chamber> = {
  mess: { x: 512, y: 310, rx: 100, ry: 52, label: 'COMMONS', bend: 0 },
  bridge: { x: 512, y: 132, rx: 46, ry: 22, label: 'SURFACE SHAFT', bend: 14 },
  hold: { x: 215, y: 185, rx: 82, ry: 42, label: 'STORES', bend: -38 },
  sensors: { x: 815, y: 180, rx: 86, ry: 38, label: 'SCOUT GALLERY', bend: 36 },
  engine: { x: 130, y: 335, rx: 62, ry: 36, label: 'PUMP', bend: 30 },
  workshop: { x: 270, y: 465, rx: 86, ry: 44, label: 'WORKS', bend: 34 },
  reactor: { x: 520, y: 482, rx: 78, ry: 38, label: 'PROVING CHAMBER', bend: -16 },
  cryo: { x: 770, y: 455, rx: 88, ry: 42, label: 'DORMITORY', bend: -32 },
  comms: { x: 905, y: 320, rx: 66, ry: 36, label: 'OUTER GALLERY', bend: -28 },
}

const BONE = '#e4dcc8'
const TEAL = ['#157f75', '#27a195', '#0f6a62']
const ALARM = '#d9482b'

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// The same seed draws the same swarm, so a redraw moves nothing by itself.
function rng(seed: number): () => number {
  let s = seed >>> 0

  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0

    return s / 4294967296
  }
}

function control(to: Chamber): [number, number] {
  const hub = CHAMBERS[HUB]
  const mx = (hub.x + to.x) / 2
  const my = (hub.y + to.y) / 2
  const dx = to.x - hub.x
  const dy = to.y - hub.y
  const len = Math.hypot(dx, dy) || 1

  return [Math.round(mx - (dy / len) * to.bend), Math.round(my + (dx / len) * to.bend)]
}

function unit(path: string, dur: number, phase: number, now: number, lane: number, fill: string): string {
  const begin = -(((now + phase * dur) % dur) + dur) % dur

  return `<rect x="-4" y="${(lane - 1.6).toFixed(1)}" width="8" height="3.2" rx="1.6" fill="${fill}"><animateMotion dur="${dur.toFixed(1)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite" rotate="auto" path="${path}"/></rect>`
}

function mill(c: Chamber, count: number, pace: number, spread: number, fill: string | undefined, rand: () => number, now: number): string {
  let out = ''
  for (let i = 0; i < count; i += 1) {
    const f = 0.25 + rand() * 0.6 * spread
    const a = Math.round(c.rx * f)
    const b = Math.round(c.ry * f * (0.7 + rand() * 0.3))
    const ox = Math.round((rand() - 0.5) * c.rx * 0.3)
    const oy = Math.round((rand() - 0.5) * c.ry * 0.3)
    const sweep = rand() < 0.5 ? 0 : 1
    const path = `M${c.x + ox - a} ${c.y + oy}a${a} ${b} 0 1 ${sweep} ${2 * a} 0a${a} ${b} 0 1 ${sweep} ${-2 * a} 0`
    const tone = fill ?? TEAL[Math.floor(rand() * TEAL.length)] ?? TEAL[0] ?? ''
    out += unit(path, (6 + rand() * 9) * pace * (0.5 + f), rand(), now, (rand() - 0.5) * 3, tone)
  }

  return out
}

function column(to: Chamber, count: number, pace: number, fill: string | undefined, rand: () => number, now: number): string {
  const hub = CHAMBERS[HUB]
  const [bx, by] = control(to)
  const path = `M${hub.x} ${hub.y}Q${bx} ${by} ${to.x} ${to.y}Q${bx} ${by} ${hub.x} ${hub.y}`
  const length = Math.hypot(to.x - hub.x, to.y - hub.y)
  let out = ''
  for (let i = 0; i < count; i += 1) {
    const tone = fill ?? TEAL[Math.floor(rand() * TEAL.length)] ?? TEAL[0] ?? ''
    out += unit(path, (length / 38) * pace * (0.85 + rand() * 0.3), rand(), now, (rand() - 0.5) * 8, tone)
  }

  return out
}

function wrap(text: string, width: number, max: number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line !== '' && (line + ' ' + word).length > width) {
      lines.push(line)
      line = word
    } else {
      line = line === '' ? word : line + ' ' + word
    }
  }
  if (line !== '') {
    lines.push(line)
  }

  return lines.length > max ? [...lines.slice(0, max - 1), (lines[max - 1] ?? '').slice(0, width - 1) + '…'] : lines
}

/** The colony as one SVG document; `now` is seconds, so motion carries over a redraw. */
export function colonyScene(ship: Ship, now: number): string {
  const voice = VOICES.colony
  const rand = rng(7)
  const hub = CHAMBERS[HUB]
  const lamp = ship.alert === 'breach' ? ALARM : ship.alert === 'allstop' ? '#c9a94a' : '#27a195'
  const isDormant = ship.alert === 'allstop'

  const byStation = new Map<Station, Mate[]>()
  for (const m of ship.crew) {
    byStation.set(m.station, [...(byStation.get(m.station) ?? []), m])
  }

  const specks = Array.from({ length: 70 }, () => {
    const x = Math.round(rand() * WIDTH)
    const y = Math.round(78 + rand() * 470)

    return `<circle cx="${x}" cy="${y}" r="${(0.6 + rand() * 1.2).toFixed(1)}" fill="#2c3036"/>`
  }).join('')

  let tunnels = ''
  let rooms = ''
  let labels = ''
  for (const id of Object.keys(CHAMBERS) as Station[]) {
    const c = CHAMBERS[id]
    const here = byStation.get(id) ?? []
    const busy = here.filter(m => m.isBusy)
    const isBreached = ship.alert === 'breach' && ship.breachAt === id
    if (id !== HUB) {
      const [bx, by] = control(c)
      tunnels += `<path d="M${hub.x} ${hub.y}Q${bx} ${by} ${c.x} ${c.y}" fill="none" stroke="${BONE}" stroke-width="15" stroke-linecap="round"/>`
    }
    const flash = isBreached
      ? `<animate attributeName="fill" values="${BONE};#f0b4a2;${BONE}" dur="0.7s" repeatCount="indefinite"/>`
      : ''
    rooms += `<ellipse cx="${c.x}" cy="${c.y}" rx="${c.rx}" ry="${c.ry}" fill="${BONE}" stroke="#bdb49c" stroke-width="1.5">${flash}</ellipse>`
    const below = c.y > 400
    const ly = below ? c.y + c.ry + 18 : c.y - c.ry - 9
    const tags = busy.map(m => alias('colony', m.name)).join(' ')
    const lx = id === 'bridge' ? c.x + c.rx + 10 : id === HUB ? c.x - 62 : c.x
    const anchor = id === 'bridge' ? 'start' : 'middle'
    labels += `<text x="${lx}" y="${id === 'bridge' ? c.y + 4 : ly}" font-size="10.5" text-anchor="${anchor}" fill="${isBreached ? ALARM : busy.length > 0 ? '#e8ecee' : '#7d848b'}" font-family="monospace" letter-spacing="1.5">${c.label}${tags === '' ? '' : ' · ' + tags}</text>`
  }
  // The shaft, and the ground it reaches.
  tunnels += `<path d="M512 132V74" fill="none" stroke="${BONE}" stroke-width="13" stroke-linecap="round"/>`
  const ground = `<path d="M24 74H${WIDTH - 24}" stroke="#7d848b" stroke-width="1.5"/>${Array.from({ length: 49 }, (_, i) => `<path d="M${30 + i * 20} 74l-7 -8" stroke="#565c63" stroke-width="1"/>`).join('')}<text x="${WIDTH - 28}" y="60" font-size="10.5" text-anchor="end" fill="#7d848b" font-family="monospace" letter-spacing="1.5">SURFACE</text>`

  let swarm = ''
  for (const id of Object.keys(CHAMBERS) as Station[]) {
    const c = CHAMBERS[id]
    const here = byStation.get(id) ?? []
    const busy = here.filter(m => m.isBusy).length
    const idle = here.length - busy
    const isBreached = ship.alert === 'breach' && ship.breachAt === id
    if (busy > 0) {
      const fill = isBreached ? ALARM : undefined
      swarm += mill(c, Math.min(70, 34 + busy * 12), isBreached ? 0.35 : 0.8, isBreached ? 1.5 : 1, fill, rand, now)
      if (id !== HUB) {
        swarm += column(c, 30, isBreached ? 0.5 : 1, fill, rand, now)
      }
    }
    if (idle > 0) {
      swarm += mill(c, id === HUB ? 16 * idle : 12 * idle, 2.4, 0.9, undefined, rand, now)
    }
  }
  // The mass that is always in the commons, and the few that wander off when nothing is asked of them.
  swarm += mill(hub, isDormant ? 80 : 30, isDormant ? 2.6 : 1.4, 1.1, undefined, rand, now)
  if (isDormant) {
    for (const id of ['hold', 'cryo', 'workshop', 'sensors'] as const) {
      swarm += column(CHAMBERS[id], 6, 3.2, undefined, rand, now)
    }
  }

  const last = ship.log[ship.log.length - 1]
  const note = last === undefined ? [] : wrap(alias('colony', `${last.who}: ${last.text}`), 118, 2)
  const notes = note
    .map((l, i) => `<text x="64" y="${606 + i * 16}" font-size="12" fill="#aab1b7" font-family="monospace">${esc(l)}</text>`)
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="#1b1e22"/>${specks}<text x="28" y="34" font-size="12" fill="#aab1b7" font-family="monospace" letter-spacing="2">FIG. 1  ${esc(voice.title.toUpperCase())}, SECTION A–A</text><path d="M${WIDTH - 148} 30h120m-120 -4v8m60 -6v4m60 -6v8" stroke="#7d848b" stroke-width="1" fill="none"/>${ground}${tunnels}${rooms}${swarm}${labels}<path d="M28 566H${WIDTH - 28}" stroke="#33383e" stroke-width="1"/><circle cx="38" cy="584" r="6" fill="${lamp}">${ship.alert === 'underway' ? '' : '<animate attributeName="opacity" values="1;0.3;1" dur="1.2s" repeatCount="indefinite"/>'}</circle><text x="54" y="589" font-size="14" fill="${lamp}" font-family="monospace" letter-spacing="2">${voice.banners[ship.alert]}</text><text x="${WIDTH - 28}" y="589" font-size="11" text-anchor="end" fill="#7d848b" font-family="monospace">TASKS ${ship.jobs}  COLLAPSES ${ship.breaches}  COHORTS ROUSED ${ship.hires}</text>${notes}</svg>`
}

export function colonyLabel(station: Station): string {
  return CHAMBERS[station].label
}

export function colonyDescribe(ship: Ship): string {
  const busy = ship.crew.filter(m => m.isBusy).map(m => `${alias('colony', m.name)} at the ${CHAMBERS[m.station].label.toLowerCase()}`)

  return `A colony of small units in tunnels and chambers, seen in section. ${busy.length === 0 ? 'Dormant.' : busy.join('; ') + '.'}`
}
