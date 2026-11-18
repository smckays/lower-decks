import type { Mate, Ship, Station } from '../types'
import { SHIP_ART, SHIP_SCALE, SPRITES } from './art'

type Room = { x: number; y: number; w: number; h: number; label: string }

// Where each compartment sits in the ship illustration (1024 x 572).
const ROOMS: Record<Station, Room> = {
  hold: { x: 298, y: 158, w: 150, h: 110, label: 'HOLD' },
  mess: { x: 468, y: 158, w: 152, h: 110, label: 'MESS' },
  comms: { x: 640, y: 158, w: 116, h: 110, label: 'COMMS' },
  sensors: { x: 775, y: 206, w: 125, h: 62, label: 'SENSORS' },
  engine: { x: 142, y: 302, w: 133, h: 114, label: 'ENGINES' },
  reactor: { x: 296, y: 302, w: 134, h: 114, label: 'REACTOR' },
  workshop: { x: 450, y: 302, w: 132, h: 114, label: 'WORKSHOP' },
  cryo: { x: 602, y: 302, w: 154, h: 114, label: 'CRYO' },
  bridge: { x: 775, y: 302, w: 125, h: 114, label: 'BRIDGE DOOR' },
}

const WIDTH = 1024
const HEIGHT = 630
// The whole document has to stay under the engine's 131,072 characters.
const BUDGET = 124000
const TALL = 62

// Overalls: the lineup's own five, then the later hires.
const SUITS: Record<string, [string, string]> = {
  'Chief Hask': ['#62848B', '#4F6E76'],
  Gary: ['#B4572E', '#8E4424'],
  Mott: ['#77813F', '#5D6631'],
  Pim: ['#348B85', '#286E69'],
  Dregs: ['#7A5483', '#5F4167'],
  Vex: ['#A23B4A', '#7F2E3A'],
  Oona: ['#B98A2E', '#916C24'],
  Skiv: ['#6B6F78', '#53565E'],
  Lump: ['#C26A9A', '#9A537A'],
}

const AT_WORK: Record<Station, string> = {
  hold: 'carry',
  workshop: 'weld',
  engine: 'lever',
  sensors: 'radar',
  comms: 'radar',
  reactor: 'panic',
  cryo: 'shrug',
  bridge: 'shrug',
  mess: 'shrug',
}

const AT_REST: Record<Station, string> = {
  hold: 'sleep',
  cryo: 'sleep',
  reactor: 'coffee',
  engine: 'coffee',
  workshop: 'broom',
  sensors: 'glare',
  comms: 'cards',
  bridge: 'glare',
  mess: 'glare',
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function short(name: string): string {
  return name.replace('Chief ', '')
}

function poseOf(m: Mate, isTaunting: boolean): string {
  const portrait = short(m.name).toLowerCase()
  if (m.station === 'mess') {
    if (isTaunting && !m.isBusy) {
      return 'laugh'
    }

    return SPRITES[portrait] === undefined ? (m.isBusy ? 'shrug' : 'glare') : portrait
  }

  return m.isBusy ? AT_WORK[m.station] : AT_REST[m.station]
}

function nameTag(m: Mate, x: number, floor: number): string {
  return `<text x="${x}" y="${floor + 11}" font-size="10" text-anchor="middle" fill="#f1f5f7" stroke="#1a2329" stroke-width="2.5" paint-order="stroke" font-family="monospace">${esc(short(m.name))}</text>`
}

function figure(m: Mate, pose: string, x: number, floor: number, tall: number): string {
  const art = SPRITES[pose]
  if (art === undefined) {
    return stick(m, x, floor)
  }
  const [suit, shade] = SUITS[m.name] ?? [`hsl(${m.hue} 45% 45%)`, `hsl(${m.hue} 45% 34%)`]
  const k = tall / art.h
  const body = art.body.replace(/\{o\}/g, suit).replace(/\{d\}/g, shade)
  const bob = m.isBusy
    ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="${0.5 + (m.hue % 5) * 0.07}s" repeatCount="indefinite"/>`
    : ''

  return `<g>${bob}<g transform="translate(${(x - (art.w * k) / 2).toFixed(1)} ${floor - tall}) scale(${k.toFixed(3)})">${body}</g></g>${nameTag(m, x, floor)}`
}

// A few shapes, for when the drawing has no room left for another illustration.
function stick(m: Mate, x: number, floor: number): string {
  const suit = (SUITS[m.name] ?? [`hsl(${m.hue} 45% 45%)`])[0]

  return `<g transform="translate(${x} ${floor})"><rect x="-10" y="-26" width="20" height="26" rx="6" fill="${suit}"/><circle cx="0" cy="-36" r="12" fill="#7AA763"/><path d="M -13 -38 A 13 13 0 0 1 13 -38 Z" fill="#F4D637"/><circle cx="-4" cy="-34" r="2" fill="#1a2329"/><circle cx="4" cy="-34" r="2" fill="#1a2329"/></g>${nameTag(m, x, floor)}`
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
  if (lines.length > max) {
    return [...lines.slice(0, max - 1), (lines[max - 1] ?? '').slice(0, width - 1) + '…']
  }

  return lines
}

function bubble(text: string, x: number, y: number): string {
  const lines = wrap(text, 36, 3)
  const w = Math.max(...lines.map(l => l.length)) * 7.3 + 20
  const h = lines.length * 15 + 10
  const left = Math.max(6, Math.min(WIDTH - 6 - w, x - w / 2))
  const top = Math.max(4, y - 12 - h)
  const tip = Math.max(left + 10, Math.min(left + w - 10, x))
  const rows = lines
    .map((l, i) => `<text x="${left + 10}" y="${top + 17 + i * 15}" font-size="12" fill="#1a2329" font-family="monospace">${esc(l)}</text>`)
    .join('')

  return `<g><polygon points="${tip - 7},${top + h - 1} ${tip + 7},${top + h - 1} ${x},${top + h + 10}" fill="#f4f1e4"/><rect x="${left}" y="${top}" width="${w}" height="${h}" rx="7" fill="#f4f1e4"/>${rows}</g>`
}

/** The whole ship as one SVG document. */
export function scene(ship: Ship, name: string): string {
  const isMoving = ship.alert !== 'allstop'
  const lamp = ship.alert === 'breach' ? '#ff4d4d' : ship.alert === 'allstop' ? '#f2b632' : '#2bd9a0'
  const banner =
    ship.alert === 'breach' ? 'HULL BREACH. AGAIN.' : ship.alert === 'allstop' ? 'ALL STOP. AWAITING THE BRIDGE.' : 'UNDERWAY. ALLEGEDLY.'
  const last = ship.log[ship.log.length - 1]

  const stars = [
    [40, 60], [150, 30], [330, 70], [470, 26], [560, 80], [860, 50], [975, 140], [1000, 330],
    [30, 250], [60, 520], [240, 540], [420, 500], [640, 520], [900, 500], [960, 560], [20, 400],
  ]
    .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 2.2 : 1.3}" fill="#cfd8dc" opacity="${0.4 + (i % 4) * 0.15}"/>`)
    .join('')

  const flames = isMoving
    ? [182, 332, 398]
        .map(
          (y, i) =>
            `<polygon points="72,${y - 16} 72,${y + 16} 18,${y}" fill="#ff9d3c"><animate attributeName="points" values="72,${y - 16} 72,${y + 16} 18,${y};72,${y - 16} 72,${y + 16} 44,${y};72,${y - 16} 72,${y + 16} 18,${y}" dur="${0.25 + i * 0.07}s" repeatCount="indefinite"/></polygon>`,
        )
        .join('')
    : ''

  const byStation = new Map<Station, Mate[]>()
  for (const m of ship.crew) {
    byStation.set(m.station, [...(byStation.get(m.station) ?? []), m])
  }

  let shade = ''
  let tags = ''
  const placed: { m: Mate; x: number; floor: number; tall: number }[] = []
  for (const id of Object.keys(ROOMS) as Station[]) {
    const r = ROOMS[id]
    const here = byStation.get(id) ?? []
    const isLit = here.length > 0
    if (ship.alert === 'breach' && ship.breachAt === id) {
      shade += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#e02020" opacity="0.45"><animate attributeName="opacity" values="0.45;0.15;0.45" dur="0.6s" repeatCount="indefinite"/></rect>`
    } else if (!isLit) {
      shade += `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#0a1016" opacity="0.38"/>`
    }
    tags += `<text x="${r.x + 7}" y="${r.y + 15}" font-size="10" fill="${isLit ? '#1a2329' : '#e8f1f5'}" font-family="monospace" letter-spacing="1" font-weight="bold">${r.label}</text>`
    const step = Math.min(46, (r.w - 30) / Math.max(1, here.length))
    const start = r.x + r.w / 2 - (step * (here.length - 1)) / 2
    // A crowd shrinks a little so nobody stands inside anybody else.
    const tall = here.length >= 4 ? Math.round(TALL * 0.8) : TALL
    here.forEach((m, i) => placed.push({ m, x: Math.round(start + step * i), floor: r.y + r.h, tall }))
  }

  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}"><rect width="${WIDTH}" height="${HEIGHT}" fill="#0a1016"/>${stars}${flames}<g transform="scale(${SHIP_SCALE})">${SHIP_ART}</g>${shade}${tags}`
  const speaker = last === undefined ? undefined : placed.find(p => p.m.name === last.who)
  const said = last !== undefined && speaker !== undefined ? bubble(last.text, speaker.x, speaker.floor - speaker.tall) : ''
  const foot = `<text x="512" y="38" font-size="18" text-anchor="middle" fill="#8d99a6" font-family="monospace" letter-spacing="4">${esc(name.toUpperCase())}</text><circle cx="120" cy="596" r="9" fill="${lamp}">${ship.alert === 'underway' ? '' : '<animate attributeName="opacity" values="1;0.25;1" dur="0.8s" repeatCount="indefinite"/>'}</circle><text x="140" y="602" font-size="17" fill="${lamp}" font-family="monospace" letter-spacing="2">${banner}</text><text x="900" y="602" font-size="12" text-anchor="end" fill="#6f8594" font-family="monospace">JOBS ${ship.jobs}  BREACHES ${ship.breaches}  HIRES ${ship.hires}</text>${said}</svg>`

  let crew = ''
  for (const p of placed) {
    const isTaunting = last !== undefined && last.kind === 'idle' && last.who === p.m.name
    const drawn = figure(p.m, poseOf(p.m, isTaunting), p.x, p.floor, p.tall)
    crew += head.length + crew.length + drawn.length + foot.length > BUDGET ? stick(p.m, p.x, p.floor) : drawn
  }

  return head + crew + foot
}

/** What the picture says, for a surface that draws no picture. */
export function describe(ship: Ship): string {
  const posts = ship.crew.map(m => `${m.name} ${m.isBusy ? 'working' : 'idle'} in ${ROOMS[m.station].label.toLowerCase()}`)

  return `The freighter in cross-section. ${posts.join('; ')}.`
}

export function roomLabel(station: Station): string {
  return ROOMS[station].label
}
