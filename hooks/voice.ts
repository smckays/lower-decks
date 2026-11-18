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
  'Retrieved {x} from the hold. It is what it says it is.',
  'Opened {x}. Contents as feared.',
  'Read {x}. No further questions. Several further concerns.',
  'Inventoried {x}. Noted.',
]
const SEARCH = [
  'Scanning for {x}. Results are present.',
  'Looked for {x}. Found some. Unclear if that helps.',
  'Sensor sweep: {x}. The void has been informed.',
]
const EDIT = [
  'Adjusted {x}. It was fine before, by some definitions.',
  'Welded {x}. It is now differently wrong.',
  'Repaired {x}. Time will be the judge. Time is harsh.',
  'Changed {x}. Someone will ask why.',
]
const WRITE = [
  'Built {x}. It exists now. That is the report.',
  'New part: {x}. Not on any manifest.',
]
const RUN = [
  'Pulled the lever: {x}. Something happened.',
  'Engines: {x}. Proceeding as if that was intended.',
  'Ran {x}. The noise is within the usual range of noises.',
]
const TEST = [
  'Reactor check: {x}. Gary volunteered. Gary was told he volunteered.',
  'Testing {x}. Expectations have been managed.',
  'Inspecting the core: {x}. It is still a core.',
]
const COMMS = [
  'Contacted the outside regarding {x}. They are aware of us.',
  'Comms: {x}. Message sent. Regret pending.',
]
const HIRE = [
  'Woke one up for: {x}. They did not ask to be here either.',
  'Assigned: {x}. Orientation was a shrug.',
]
const BRIDGE = [
  'Question sent to the bridge. We will be here.',
  'Asked the Captain. This is the waiting part.',
]
const MANUAL = [
  'Consulted the manual on {x}. It was written by an optimist.',
  'Looked up {x}. The manual says to consult the manual.',
]
const OTHER = [
  'Used {x}. Nobody is certified for this. Nobody is certified.',
  'Operated {x}. It tolerated us.',
]

export const BREACH = [
  'Hull breach. Logged.',
  'That failed. Adding it to the others.',
  'An alarm. It joins the alarms.',
  'It broke. In fairness, it was going to.',
]
export const ORDERS = [
  'New orders. We have read them.',
  'The bridge has a request. Noted, with feelings withheld.',
  'Instructions received. Enthusiasm not included.',
]
export const IDLE = [
  'All stop. The Captain is deciding. We have seen this before.',
  'Work complete. No one has thanked us. Schedule holds.',
  'Idle. This is the most reliable system on the ship.',
  'Standing by. It is going well.',
]
export const WRECK = [
  'The shift ended early. Not by choice.',
  'Called off mid-job. Tools down. Nothing further.',
]
export const OFF = [
  'Shift over. Left without comment.',
  'Finished. Reports that it went fine. We will see.',
  'Done. Took the good chair on the way out.',
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

export const LOG_SYSTEM = `You write the unofficial ship's log of the ${SHIP}, a badly maintained cargo freighter, in the voice of its lower-deck crew. The Captain (never seen) sends orders down a tube; the crew does the work.

The humour is dry: flat, understated, matter-of-fact, the tone of a maintenance report written by someone who has stopped expecting anything. Short declarative sentences. Understatement over exaggeration. No exclamation marks, no wacky similes, no puns, no winking at the reader. The joke is in what is left unsaid.

You are given a real status update from the engineer running the job. Rewrite it as ONE log entry, 140 characters at most, in that voice. Keep the concrete fact (what was found, done or about to be done) recognisable, in freighter terms where natural. No quotation marks around the entry, no emoji, no preamble. Output only the entry.`

export function clipLine(value: string, max: number): string {
  return clip(value, max)
}

export type Quip = { text: string; at?: Station }

// Nothing to do: {a} speaks, {b} suffers. `at` is where {a} wanders off to.
export const BANTER: Quip[] = [
  { text: '{b}, that is my seat. I have had it for years. Mostly resentfully.' },
  { text: 'Someone finished the coffee. I am not accusing {b}. I am looking at {b}.' },
  { text: '{b} says morale is improving. No source was given.' },
  { text: '{b} has offered to help. The offer remains an offer.' },
  { text: 'Going to the hold. It is quieter. {b} is not in it.', at: 'hold' },
  { text: '{b} owes me eleven shifts. I have stopped mentioning it. This is me not mentioning it.' },
  { text: '{b} is breathing again. I have decided to allow it.' },
  { text: '{b} is humming. I have filed nothing. I want that on the record.' },
  { text: 'Standing by the reactor. It is warm and does not talk. Unlike {b}.', at: 'reactor' },
  { text: 'Counted the rivets. One fewer than yesterday. {b} was near the rivets.' },
  { text: '{b} asked if the Captain is real. I said the question was above our grade.' },
  { text: 'Lying down in a cryo pod. If asked, {b} can say I am recalibrating it.', at: 'cryo' },
  { text: '{b} told a joke. We are all processing it in our own way.' },
  { text: 'Checking the sensors. They work. I will be checking them for some time.', at: 'sensors' },
  { text: '{b} called this downtime "restful." {b} is new to rest.' },
  { text: 'Tightening a bolt. It was tight. It is still tight. {b} may inspect it.', at: 'workshop' },
  { text: '{b} expects a bonus. I did not correct them. It is not my place.' },
  { text: 'Returned to the mess. The other rooms were also rooms.', at: 'mess' },
  { text: 'For the log: {b} and I are conducting a review. Of what, the log need not say.' },
  { text: 'Listening to the engines. They have less to say than {b}. I prefer it.', at: 'engine' },
]
