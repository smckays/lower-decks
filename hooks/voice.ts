import type { Setting, Station } from '../types'

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

export type Kind = 'read' | 'search' | 'edit' | 'write' | 'run' | 'test' | 'comms' | 'hire' | 'bridge' | 'manual' | 'other'

export type Job = { station: Station; kind: Kind }

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
      return { station: 'hold', kind: 'read', subject: file || 'a crate' }
    case 'Grep':
    case 'Glob':
      return { station: 'sensors', kind: 'search', subject: clip(text(input.pattern), 32) || 'something' }
    case 'Edit':
    case 'NotebookEdit':
      return { station: 'workshop', kind: 'edit', subject: file || 'the hull' }
    case 'Write':
      return { station: 'workshop', kind: 'write', subject: file || 'gizmo' }
    case 'Bash': {
      const command = text(input.command)
      const subject = clip(text(input.description) || command, 48) || 'a lever'

      return isTest.test(command)
        ? { station: 'reactor', kind: 'test', subject }
        : { station: 'engine', kind: 'run', subject }
    }
    case 'WebFetch':
    case 'WebSearch':
      return { station: 'comms', kind: 'comms', subject: clip(text(input.query) || text(input.url), 40) || 'things' }
    case 'Agent':
    case 'Task':
      return { station: 'cryo', kind: 'hire', subject: clip(text(input.description), 40) || 'unspecified toil' }
    case 'AskUserQuestion':
      return { station: 'bridge', kind: 'bridge', subject: '' }
    case 'Skill':
    case 'ToolSearch':
      return { station: 'sensors', kind: 'manual', subject: clip(text(input.skill) || text(input.query), 32) || 'everything' }
    default: {
      const name = tool.startsWith('mcp__') ? tool.split('__').slice(1).join(' ') : tool

      return {
        station: tool.startsWith('mcp__') ? 'comms' : 'engine',
        kind: 'other',
        subject: clip(name.replace(/_/g, ' '), 36),
      }
    }
  }
}

export function pick(lines: readonly string[], n: number, subject = ''): string {
  return (lines[n % lines.length] ?? '').replace('{x}', subject)
}

const LOG_SYSTEM = `You write the unofficial ship's log of the ${SHIP}, a badly maintained cargo freighter, in the voice of its lower-deck crew. The Captain (never seen) sends orders down a tube; the crew does the work.

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

const COLONY_SYSTEM = `You write field notes on a colony of small identical units (bytes) living in a network of tunnels and chambers, observed from above like an ant farm. The units have no names and no faces; cohorts are known only by hex designations. Orders arrive from the Surface, which no unit has seen.

The tone is dry: a naturalist's notebook kept by someone who has watched this colony for too long. Flat, understated, precise. Short declarative sentences. No exclamation marks, no puns, no cute language, no winking. The humour is in the understatement.

You are given a real status update from the engineer running the job. Rewrite it as ONE field note, 140 characters at most, in that voice. Keep the concrete fact (what was found, done or about to be done) recognisable. No quotation marks, no emoji, no preamble. Output only the note.`

export type Voice = {
  title: string
  start: string
  system: string
  memo: string
  assigned: string
  toast: string
  work: Record<Kind, string[]>
  breach: string[]
  orders: string[]
  idle: string[]
  wreck: string[]
  off: string[]
  banter: Quip[]
  banners: { underway: string; allstop: string; breach: string }
}

export const VOICES: Record<Setting, Voice> = {
  freighter: {
    title: SHIP,
    start: 'Shift started. Attendance is technically complete.',
    system: LOG_SYSTEM,
    memo: 'Memo from upstairs, verbatim: ',
    assigned: 'Assigned. Known issue: {flaw}.',
    toast: `${SHIP}: all stop. Awaiting the bridge.`,
    work: { read: READ, search: SEARCH, edit: EDIT, write: WRITE, run: RUN, test: TEST, comms: COMMS, hire: HIRE, bridge: BRIDGE, manual: MANUAL, other: OTHER },
    breach: BREACH,
    orders: ORDERS,
    idle: IDLE,
    wreck: WRECK,
    off: OFF,
    banter: BANTER,
    banners: { underway: 'UNDERWAY. FOR NOW.', allstop: 'ALL STOP. AWAITING THE BRIDGE.', breach: 'HULL BREACH. NOTED.' },
  },
  colony: {
    title: 'Colony 7F',
    start: 'Observation resumed. The colony had not noticed it stopped.',
    system: COLONY_SYSTEM,
    memo: 'From the Surface, unaltered: ',
    assigned: 'Cohort roused and dispatched. No objection was detected.',
    toast: 'Colony 7F: dormant. Awaiting stimulus.',
    work: {
      read: ['Units carried {x} out of the stores. They did not appear impressed.', 'A column examined {x}. It was returned as found.', '{x} retrieved. The stores are no emptier for it.'],
      search: ['Scouts dispatched for {x}. Most came back.', 'The galleries were combed for {x}. Something was located.', 'Search for {x}. The colony has many places to look and used them.'],
      edit: ['Units rearranged {x}. The arrangement is new. That is all that can be said.', 'A cluster reworked {x}. It held.', '{x} altered. No unit claimed responsibility.'],
      write: ['The works produced {x}. It was not there before.', 'New structure: {x}. Purpose assumed.'],
      run: ['The pump was engaged: {x}. Flow resumed.', '{x}. The colony carried on as if this were routine.', 'Units executed {x}. Output was produced, in quantity.'],
      test: ['A cohort entered the proving chamber: {x}. Fewer theories came out.', 'Proving: {x}. The chamber does not negotiate.', '{x}, under test. The units wait in the manner of units.'],
      comms: ['A column left the colony regarding {x}. The outside remains outside.', 'Outer gallery: {x}. Contact was made, for what it is worth.'],
      hire: ['A dormant cohort was roused for: {x}.', 'The dormitory released a cohort. Task: {x}.'],
      bridge: ['A query was sent to the Surface. The colony has stopped moving, which is how it waits.', 'The Surface was consulted. Reply times vary.'],
      manual: ['Units consulted the record on {x}. The record is incomplete and confident.', 'Reference sought: {x}.'],
      other: ['Units operated {x}. Precedent for this is thin.', '{x} was used. It still works, apparently.'],
    },
    breach: ['Collapse. The units have noted it by going around.', 'A failure. It joins the sediment.', 'Tunnel lost. No unit seemed surprised.', 'It gave way. It had been giving way for some time.'],
    orders: ['Stimulus from the Surface. The colony has begun to respond.', 'New instruction arrived. Units are orienting.', 'The Surface wants something. Movement has resumed.'],
    idle: ['Dormant. Units are circling the commons. This is their natural state.', 'Activity has ceased. Nothing was lost by it.', 'The colony waits. It is better at this than the work.', 'No stimulus. The units persist anyway.'],
    wreck: ['Activity ended early. The units did not decide this.', 'Halted from above. Columns dispersed without comment.'],
    off: ['Cohort returned to the dormitory. Result unverified.', 'Task ended. The cohort dissolved back into the mass.', 'Done. No unit stayed to explain.'],
    banter: [
      { text: 'Cohort {a} has formed a queue. Nothing is at the front of it.' },
      { text: '{a} and {b} have met in a tunnel. Neither is reversing.' },
      { text: '{a} is circling {b}. This has been going on for some time.' },
      { text: 'A unit from {a} left the commons, reached the stores, and returned. It carried nothing.', at: 'hold' },
      { text: '{b} has been displaced from its spot by {a}. The spot is unremarkable.' },
      { text: '{a} is inspecting the proving chamber. It is empty. The inspection continues.', at: 'reactor' },
      { text: '{a} appears to be counting {b}. The count keeps changing.' },
      { text: 'Cohort {a} has withdrawn to the dormitory. It was not tired. It was near {b}.', at: 'cryo' },
      { text: '{a} is following {b} at a fixed distance. {b} has sped up slightly.' },
      { text: 'Several units of {a} are standing still. This is being treated as a position.' },
      { text: '{a} has moved to the outer gallery to face the wall.', at: 'comms' },
      { text: '{b} built a small pile. {a} moved it four units to the left.' },
      { text: '{a} returned to the commons. The commons absorbed it.', at: 'mess' },
      { text: '{a} and {b} are exchanging something. It appears to be the same thing, back and forth.' },
      { text: 'A column from {a} is patrolling the works. Nothing there requires it.', at: 'workshop' },
    ],
    banners: { underway: 'ACTIVE.', allstop: 'DORMANT. AWAITING STIMULUS.', breach: 'COLLAPSE. NOTED.' },
  },
}

// Bytes have designations, not names.
const HEX: Record<string, string> = {
  'Chief Hask': '0x00', Gary: '0x1F', Mott: '0x2A', Pim: '0x3C', Dregs: '0x4D',
  Vex: '0x5E', Oona: '0x6B', Skiv: '0x77', Lump: '0x7F', Ship: 'Colony',
}

/** A crew name as the setting knows it. */
export function alias(setting: Setting, text: string): string {
  if (setting !== 'colony') {
    return text
  }

  return text.replace(/Chief Hask|Gary|Mott|Pim|Dregs|Vex|Oona|Skiv|Lump|Ship/g, name => HEX[name] ?? name)
}
