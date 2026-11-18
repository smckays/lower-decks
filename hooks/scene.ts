import type { Mate, Ship, Station } from '../types'

type Room = { x: number; y: number; w: number; h: number; label: string }

const TOP = 70
const MID = 150
const LOW = 235

// A side cross-section: engines to the left, nose to the right.
const ROOMS: Record<Station, Room> = {
  mess: { x: 50, y: TOP, w: 100, h: 80, label: 'MESS' },
  sensors: { x: 150, y: TOP, w: 100, h: 80, label: 'SENSORS' },
  comms: { x: 250, y: TOP, w: 90, h: 80, label: 'COMMS' },
  bridge: { x: 340, y: TOP, w: 90, h: 80, label: 'BRIDGE' },
  reactor: { x: 50, y: MID, w: 70, h: 85, label: 'REACTOR' },
  engine: { x: 120, y: MID, w: 80, h: 85, label: 'ENGINES' },
  workshop: { x: 200, y: MID, w: 85, h: 85, label: 'WORKSHOP' },
  hold: { x: 285, y: MID, w: 80, h: 85, label: 'HOLD' },
  cryo: { x: 365, y: MID, w: 65, h: 85, label: 'CRYO' },
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function prop(station: Station, r: Room, isLit: boolean): string {
  const cx = r.x + r.w / 2
  const floor = r.y + r.h
  const dim = '#3d4f5c'

  switch (station) {
    case 'hold':
      return `<rect x="${r.x + 8}" y="${floor - 16}" width="16" height="14" fill="#7a5a3a"/><rect x="${r.x + 26}" y="${floor - 12}" width="12" height="10" fill="#8a6a45"/><rect x="${r.x + 12}" y="${floor - 28}" width="13" height="12" fill="#6b4e33"/>`
    case 'reactor':
      return `<circle cx="${cx}" cy="${r.y + 34}" r="13" fill="${isLit ? '#2bd9a0' : '#1d6f5a'}" opacity="0.9">${isLit ? '<animate attributeName="r" values="12;15;12" dur="1.1s" repeatCount="indefinite"/>' : ''}</circle><circle cx="${cx}" cy="${r.y + 34}" r="18" fill="none" stroke="${dim}" stroke-width="2"/>`
    case 'engine':
      return `<rect x="${r.x + 10}" y="${r.y + 22}" width="10" height="26" fill="${dim}"/><rect x="${r.x + 26}" y="${r.y + 22}" width="10" height="26" fill="${dim}">${isLit ? '<animate attributeName="height" values="26;14;26" dur="0.7s" repeatCount="indefinite"/>' : ''}</rect><rect x="${r.x + 42}" y="${r.y + 22}" width="10" height="26" fill="${dim}">${isLit ? '<animate attributeName="height" values="14;26;14" dur="0.7s" repeatCount="indefinite"/>' : ''}</rect>`
    case 'workshop':
      return `<rect x="${r.x + 10}" y="${floor - 14}" width="34" height="4" fill="#8d99a6"/><rect x="${r.x + 13}" y="${floor - 10}" width="3" height="10" fill="#8d99a6"/><rect x="${r.x + 38}" y="${floor - 10}" width="3" height="10" fill="#8d99a6"/>${isLit ? `<circle cx="${r.x + 27}" cy="${floor - 17}" r="2" fill="#ffd54a"><animate attributeName="opacity" values="1;0;1;0.3;1" dur="0.35s" repeatCount="indefinite"/></circle>` : ''}`
    case 'sensors':
      return `<path d="M ${cx - 16} ${r.y + 42} A 16 16 0 0 1 ${cx + 16} ${r.y + 42}" fill="none" stroke="#8d99a6" stroke-width="3"/><line x1="${cx}" y1="${r.y + 42}" x2="${cx}" y2="${r.y + 28}" stroke="#8d99a6" stroke-width="2"/>${isLit ? `<circle cx="${cx}" cy="${r.y + 26}" r="3" fill="none" stroke="#62d0ff"><animate attributeName="r" values="2;14" dur="1s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="1s" repeatCount="indefinite"/></circle>` : ''}`
    case 'comms':
      return `<line x1="${cx}" y1="${r.y + 46}" x2="${cx}" y2="${r.y + 20}" stroke="#8d99a6" stroke-width="2"/><circle cx="${cx}" cy="${r.y + 19}" r="3" fill="${isLit ? '#ff6b6b' : dim}">${isLit ? '<animate attributeName="opacity" values="1;0.2;1" dur="0.8s" repeatCount="indefinite"/>' : ''}</circle>`
    case 'cryo':
      return `<rect x="${r.x + 9}" y="${r.y + 20}" width="14" height="30" rx="7" fill="#23485c" stroke="#62d0ff" stroke-width="1"/><rect x="${r.x + 28}" y="${r.y + 20}" width="14" height="30" rx="7" fill="#23485c" stroke="#62d0ff" stroke-width="1"/><rect x="${r.x + 47}" y="${r.y + 20}" width="14" height="30" rx="7" fill="#23485c" stroke="#62d0ff" stroke-width="1" opacity="0.6"/>`
    case 'mess':
      return `<rect x="${r.x + 14}" y="${floor - 13}" width="40" height="3" fill="#8d99a6"/><rect x="${r.x + 32}" y="${floor - 10}" width="3" height="10" fill="#8d99a6"/><rect x="${r.x + 20}" y="${floor - 18}" width="5" height="5" fill="#d9c9a3"/>`
    case 'bridge':
      return `<rect x="${r.x + 30}" y="${r.y + 20}" width="30" height="${r.h - 20}" fill="#0d151b" stroke="${dim}"/><text x="${r.x + 45}" y="${r.y + 44}" font-size="5.5" text-anchor="middle" fill="#ff6b6b" font-family="monospace">NO CREW</text><text x="${r.x + 45}" y="${r.y + 52}" font-size="5.5" text-anchor="middle" fill="#ff6b6b" font-family="monospace">BEYOND</text><text x="${r.x + 45}" y="${r.y + 60}" font-size="5.5" text-anchor="middle" fill="#ff6b6b" font-family="monospace">THIS POINT</text>`
  }
}

function dude(m: Mate, x: number, y: number, labelY = 11): string {
  const suit = `hsl(${m.hue} 55% 52%)`
  const bob = m.isBusy
    ? `<animateTransform attributeName="transform" type="translate" values="0 0;0 -3;0 0" dur="${0.5 + (m.hue % 5) * 0.06}s" repeatCount="indefinite"/>`
    : ''
  const arm = m.isBusy
    ? `<line x1="4" y1="-8" x2="9" y2="-12" stroke="${suit}" stroke-width="2.4" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" values="0 4 -8;-35 4 -8;0 4 -8" dur="0.4s" repeatCount="indefinite"/></line>`
    : `<text x="6" y="-16" font-size="7" fill="#9fb3c0" font-family="monospace">z</text>`

  return `<g transform="translate(${x} ${y})"><g>${bob}<rect x="-2.6" y="-1" width="2.2" height="4" fill="#27333b"/><rect x="0.6" y="-1" width="2.2" height="4" fill="#27333b"/><rect x="-4.5" y="-11" width="9" height="11" rx="3" fill="${suit}"/><line x1="-4" y1="-8" x2="-8" y2="-4" stroke="${suit}" stroke-width="2.4" stroke-linecap="round"/>${arm}<circle cx="0" cy="-15" r="5" fill="#b9e08a"/><path d="M -5.4 -16 A 5.4 5.4 0 0 1 5.4 -16 Z" fill="#f2b632"/><rect x="-6.5" y="-16.6" width="13" height="1.4" rx="0.7" fill="#f2b632"/><circle cx="-1.8" cy="-13.6" r="0.9" fill="#1a2329"/><circle cx="1.8" cy="-13.6" r="0.9" fill="#1a2329"/><line x1="-1.6" y1="-11.4" x2="1.6" y2="-11.4" stroke="#1a2329" stroke-width="0.8"/></g><text y="${labelY}" font-size="6.5" text-anchor="middle" fill="#dfe8ee" font-family="monospace">${esc(m.name.replace('Chief ', ''))}</text></g>`
}

/** The whole ship as one SVG document. */
export function scene(ship: Ship, name: string): string {
  const isMoving = ship.alert !== 'allstop'
  const lamp = ship.alert === 'breach' ? '#ff4d4d' : ship.alert === 'allstop' ? '#f2b632' : '#2bd9a0'
  const banner =
    ship.alert === 'breach' ? 'HULL BREACH. AGAIN.' : ship.alert === 'allstop' ? 'ALL STOP. AWAITING THE BRIDGE.' : 'UNDERWAY. ALLEGEDLY.'

  const byStation = new Map<Station, Mate[]>()
  for (const m of ship.crew) {
    byStation.set(m.station, [...(byStation.get(m.station) ?? []), m])
  }

  const stars = [
    [22, 30], [70, 18], [130, 40], [190, 14], [246, 34], [318, 20], [380, 44], [452, 26],
    [18, 270], [96, 286], [210, 274], [300, 290], [410, 278], [466, 150], [10, 150],
  ]
    .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 === 0 ? 1.2 : 0.7}" fill="#cfd8dc" opacity="${0.4 + (i % 4) * 0.15}"/>`)
    .join('')

  const rooms = (Object.keys(ROOMS) as Station[])
    .map(id => {
      const r = ROOMS[id]
      const here = byStation.get(id) ?? []
      const isLit = here.some(m => m.isBusy)
      const isBreached = ship.alert === 'breach' && ship.breachAt === id
      const fill = isBreached ? '#4a1c1c' : isLit ? '#22323d' : '#172129'
      const flash = isBreached ? '<animate attributeName="fill" values="#4a1c1c;#7a2020;#4a1c1c" dur="0.6s" repeatCount="indefinite"/>' : ''
      const step = Math.min(22, (r.w - 16) / Math.max(1, here.length))
      const start = r.x + r.w / 2 - (step * (here.length - 1)) / 2 + (id === 'bridge' ? -28 : 0)
      const crew = here.map((m, i) => dude(m, start + step * i, r.y + r.h - 18, here.length > 3 && i % 2 === 1 ? 17 : 10)).join('')

      return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${fill}" stroke="#30414d" stroke-width="1.5">${flash}</rect>${prop(id, r, isLit)}<text x="${r.x + 5}" y="${r.y + 11}" font-size="7" fill="${isLit ? '#e8f1f5' : '#6f8594'}" font-family="monospace" letter-spacing="0.6">${r.label}</text>${crew}`
    })
    .join('')

  const flames = isMoving
    ? [102, 150, 200]
        .map(
          (y, i) =>
            `<polygon points="38,${y - 7} 38,${y + 7} 10,${y}" fill="#ff9d3c"><animate attributeName="points" values="38,${y - 7} 38,${y + 7} 10,${y};38,${y - 7} 38,${y + 7} 22,${y};38,${y - 7} 38,${y + 7} 10,${y}" dur="${0.25 + i * 0.07}s" repeatCount="indefinite"/></polygon>`,
        )
        .join('')
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 300" width="480" height="300"><rect width="480" height="300" fill="#0a1016"/>${stars}${flames}<rect x="36" y="88" width="12" height="28" fill="#4a5b67"/><rect x="36" y="136" width="12" height="28" fill="#4a5b67"/><rect x="36" y="186" width="12" height="28" fill="#4a5b67"/><path d="M 44 62 H 420 Q 470 110 462 160 Q 452 215 420 243 H 44 Z" fill="#55656f" stroke="#8d99a6" stroke-width="2"/>${rooms}<line x1="385" y1="62" x2="385" y2="${TOP + 22}" stroke="#c9a227" stroke-width="3"/><text x="240" y="54" font-size="9" text-anchor="middle" fill="#8d99a6" font-family="monospace" letter-spacing="2">${esc(name.toUpperCase())}</text><circle cx="62" cy="268" r="5" fill="${lamp}">${ship.alert === 'underway' ? '' : '<animate attributeName="opacity" values="1;0.25;1" dur="0.8s" repeatCount="indefinite"/>'}</circle><text x="74" y="271.5" font-size="9" fill="${lamp}" font-family="monospace" letter-spacing="1">${banner}</text><text x="430" y="271.5" font-size="7" text-anchor="end" fill="#6f8594" font-family="monospace">JOBS ${ship.jobs}  BREACHES ${ship.breaches}  HIRES ${ship.hires}</text></svg>`
}

/** What the picture says, for a surface that draws no picture. */
export function describe(ship: Ship): string {
  const posts = ship.crew.map(m => `${m.name} ${m.isBusy ? 'working' : 'idle'} in ${ROOMS[m.station].label.toLowerCase()}`)

  return `The freighter in cross-section. ${posts.join('; ')}.`
}

export function roomLabel(station: Station): string {
  return ROOMS[station].label
}
