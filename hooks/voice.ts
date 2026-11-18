import type { Station } from '../types'

export const SHIP = 'MV Sunk Cost'

export const CHIEF = { name: 'Chief Hask', flaw: 'relays orders, absorbs blame' }

// Hired in this order. The flaw is the whole personality.
export const ROSTER = [
  { name: 'Gary', flaw: 'panics quietly' },
  { name: 'Mott', flaw: 'union rep' },
  { name: 'Pim', flaw: 'optimist, widely disliked' },
  { name: 'Dregs', flaw: 'here since the old codebase' },
  { name: 'Vex', flaw: 'files grievances' },
  { name: 'Oona', flaw: 'does the actual work' },
  { name: 'Skiv', flaw: 'stealing copper' },
  { name: 'Lump', flaw: 'technically awake' },
]

export type Job = { station: Station; lines: string[] }

const READ = [
  'Hauling {x} up from the hold. Heavier than it looks, less useful.',
  'Opened crate {x}. Packing peanuts, mostly.',
  'Reading {x}. Whoever wrote this has since fled the sector.',
  'Dragged {x} into the light. It did not improve.',
]
const SEARCH = [
  'Sweeping the sensors for {x}. Lots of static, one raccoon.',
  'Scanning for {x}. It will be in the last place, as is tradition.',
  'Pinged {x}. Space pinged back, sarcastically.',
]
const EDIT = [
  'Welding {x}. Sparks are a feature.',
  'Rewired {x}. The old wiring was load-bearing, apparently.',
  'Patched {x} with tape and a firm tone of voice.',
  'Moved a pipe in {x}. Will move it back after lunch.',
]
const WRITE = [
  'Fabricated {x} from scrap. Warranty void on contact.',
  'Bolted on a brand new {x}. Nobody requisitioned it.',
]
const RUN = [
  'Pulled the big lever: {x}. Awaiting consequences.',
  'Engine room reports: {x}. Engine room has opinions.',
  'Ran {x}. Something hummed. Humming is not always good.',
]
const TEST = [
  'Sent the new guy into the reactor to check {x}.',
  'Reactor drill: {x}. Hazard pay remains theoretical.',
  'Poking the core with a stick: {x}.',
]
const COMMS = [
  'Hailing the outside universe about {x}. It is on hold.',
  'Comms open: {x}. Paying roaming rates.',
]
const HIRE = [
  'Thawing a fresh one for: {x}. Give them a week.',
  'Cryo pod open. Assignment: {x}. They look hopeful. It will pass.',
]
const BRIDGE = [
  'Shouting up the tube to the Captain. Brace for a meeting.',
  'Requesting a decision from the bridge. Packing a lunch.',
]
const MANUAL = [
  'Consulting the manual for {x}. Half the pages are a different manual.',
  'Looking up {x}. The index is a cry for help.',
]
const OTHER = [
  'Operating {x}. Nobody was trained on this.',
  'Cranking {x}. The label has worn off, which is ominous.',
]

export const BREACH = [
  'Hull breach. Nobody panic. Gary, panic quietly.',
  'That was structural. Adding it to the list.',
  'Alarm is going off. To be fair, it usually is.',
  'It exploded, but in a way we can learn from.',
]
export const ORDERS = [
  'New orders down the tube. Nobody asked us.',
  'The bridge has had an idea. All hands, lower your expectations.',
  'Captain wants something. Captain always wants something.',
]
export const IDLE = [
  'All stop. The Captain is "thinking." Break out the cards.',
  'Work done. Awaiting praise that will arrive as more work.',
  'Engines idle. Mott is drafting a grievance to pass the time.',
  'Standing by. This is the part we are best at.',
]
export const WRECK = [
  'The whole shift fell over. Filing it under weather.',
  'Bridge called it off mid-job. Tools down, morale unchanged.',
]
export const OFF = [
  'Shift over. Back in the pod. Did not say goodbye.',
  'Clocked out. Left a mug.',
  'Done. Claims it went well. Unverified.',
]

const isTest = /\b(test|tests|pytest|jest|vitest|spec|tsc|lint|check|validate|verify)\b/i

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()

  return flat.length > max ? flat.slice(0, max - 1) + '…' : flat
}

function leaf(path: string): string {
  const parts = path.split('/').filter(Boolean)

  return parts[parts.length - 1] ?? path
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/** Which station a tool call happens at, the lines it may get, and its subject. */
export function jobOf(tool: string, input: Record<string, unknown>): Job & { subject: string } {
  const file = leaf(text(input.file_path) || text(input.notebook_path) || text(input.path))

  switch (tool) {
    case 'Read':
      return { station: 'hold', lines: READ, subject: file || 'a crate' }
    case 'Grep':
    case 'Glob':
      return { station: 'sensors', lines: SEARCH, subject: clip(text(input.pattern), 32) || 'something' }
    case 'Edit':
    case 'NotebookEdit':
      return { station: 'workshop', lines: EDIT, subject: file || 'the hull' }
    case 'Write':
      return { station: 'workshop', lines: WRITE, subject: file || 'gizmo' }
    case 'Bash': {
      const command = text(input.command)
      const subject = clip(text(input.description) || command, 48) || 'a lever'

      return isTest.test(command)
        ? { station: 'reactor', lines: TEST, subject }
        : { station: 'engine', lines: RUN, subject }
    }
    case 'WebFetch':
    case 'WebSearch':
      return { station: 'comms', lines: COMMS, subject: clip(text(input.query) || text(input.url), 40) || 'things' }
    case 'Agent':
    case 'Task':
      return { station: 'cryo', lines: HIRE, subject: clip(text(input.description), 40) || 'unspecified toil' }
    case 'AskUserQuestion':
      return { station: 'bridge', lines: BRIDGE, subject: '' }
    case 'Skill':
    case 'ToolSearch':
      return { station: 'sensors', lines: MANUAL, subject: clip(text(input.skill) || text(input.query), 32) || 'everything' }
    default: {
      const name = tool.startsWith('mcp__') ? tool.split('__').slice(1).join(' ') : tool

      return {
        station: tool.startsWith('mcp__') ? 'comms' : 'engine',
        lines: OTHER,
        subject: clip(name.replace(/_/g, ' '), 36),
      }
    }
  }
}

export function pick(lines: readonly string[], n: number, subject = ''): string {
  return (lines[n % lines.length] ?? '').replace('{x}', subject)
}

export const LOG_SYSTEM = `You write the unofficial ship's log of the ${SHIP}, a badly maintained cargo freighter, in the voice of its lower-deck crew: deadpan, sarcastic, cynical, underpaid, loyal to nobody. The Captain (never seen) sends orders down a tube; the crew does the work.

You are given a real status update from the engineer running the job. Rewrite it as ONE log line, 140 characters at most, in that voice. Keep the concrete fact (what was found, done or about to be done) recognisable, translated into freighter terms where it is natural. Vary the joke; do not open with "Well" or "Great". No quotation marks around the line, no emoji, no preamble. Output only the line.`

export function clipLine(value: string, max: number): string {
  return clip(value, max)
}

export type Quip = { text: string; at?: Station }

// Nothing to do: {a} speaks, {b} suffers. `at` is where {a} wanders off to.
export const BANTER: Quip[] = [
  { text: '{b}, you are sitting in my spot. They are all my spot.' },
  { text: 'Whoever keeps labelling their lunch "{b}": it does not work, {b}.' },
  { text: 'I am not saying {b} broke the coffee machine. The coffee machine is saying it.' },
  { text: '{b} has been "about to help" since the last refit.' },
  { text: 'Going to check the hold. Do not follow me, {b}.', at: 'hold' },
  { text: 'Dealing cards. {b} owes me eleven shifts already.' },
  { text: '{b}, breathe quieter. Some of us are doing nothing over here.' },
  { text: 'Formal complaint: {b} is humming. Second formal complaint: it is off-key.' },
  { text: 'Standing near the reactor for warmth. Tell {b} I died doing what I tolerated.', at: 'reactor' },
  { text: 'I counted the rivets again. Still one fewer than yesterday. Looking at you, {b}.' },
  { text: '{b} asked what the Captain looks like. Nobody knows. That is the benefits package.' },
  { text: 'Taking a nap in a cryo pod. If I am not back, {b} did it.', at: 'cryo' },
  { text: 'Hey {b}. {b}. {b}. Nothing, just checking you still flinch.' },
  { text: 'Pretending to recalibrate the sensors so {b} stops talking to me.', at: 'sensors' },
  { text: 'I would like it noted that {b} called this "quality downtime."' },
  { text: 'Tightening a bolt that is already tight. Supervise me, {b}.', at: 'workshop' },
  { text: '{b} thinks there will be a bonus. Let them have this.' },
  { text: 'Back in the mess. The hold was also boring, {b}, and it smelled like you.', at: 'mess' },
  { text: 'If the bridge asks, {b} and I were conducting a safety stand-down.' },
  { text: 'Listening to the engines tick. Better company than {b}.', at: 'engine' },
]
