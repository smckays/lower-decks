import { atom, read, update } from 'claude-code'
import type { Elements, Register } from 'claude-code'

import type { Entry, EntryKind, Mate, Setting, Ship, Station } from '../types'
import { circuitDescribe, circuitLabel, circuitScene } from './circuit'
import { colonyDescribe, colonyLabel, colonyScene } from './colony'
import { describe, roomLabel, scene } from './scene'
import { CHIEF, ROSTER, VOICES, alias, clipLine, jobOf, pick } from './voice'

const PANE = 'lower-decks'
const MAIN = 'main'
const MODEL = 'claude-haiku-5-5'
// The setting a new install opens in, until the person picks another.
const DEFAULT: Setting = 'circuit'

// Where each hand loafs by default, so the mess is not standing room only.
const HOME: Record<string, Station> = { Mott: 'hold', Dregs: 'comms', Vex: 'cryo', Skiv: 'hold', Lump: 'cryo' }

function voiceOf(state: Ship) {
  return VOICES[state.setting ?? DEFAULT]
}

function labelOf(state: Ship, station: Station): string {
  const setting = state.setting ?? DEFAULT

  return setting === 'colony' ? colonyLabel(station) : setting === 'circuit' ? circuitLabel(station) : roomLabel(station)
}

function homeOf(name: string): Station {
  return HOME[name] ?? 'mess'
}

const EMPTY: Ship = {
  crew: [
    { id: MAIN, ...CHIEF, hue: 200, station: 'mess', isBusy: false },
    // The standing crew: on the payroll, in the mess, until a subagent needs a body.
    ...ROSTER.slice(0, 4).map((hand, i): Mate => ({
      id: `bunk:${i}`,
      ...hand,
      hue: (i * 67 + 20) % 360,
      station: homeOf(hand.name),
      isBusy: false,
    })),
  ],
  setting: DEFAULT,
  log: [{ who: 'Ship', text: VOICES[DEFAULT].start, kind: 'idle' }],
  alert: 'allstop',
  jobs: 0,
  breaches: 0,
  hires: 0,
}

const ship = atom({ plugin: 'lower-decks', key: 'ship' } as const, EMPTY, {
  shape: 'ship-4',
})

function mateOf(state: Ship, id: string): { crew: Mate[]; mate: Mate; isNew: boolean } {
  const found = state.crew.find(m => m.id === id)
  if (found !== undefined) {
    return { crew: state.crew, mate: found, isNew: false }
  }
  // Whoever is loafing gets the job before anyone new is thawed.
  const loafer = state.crew.find(m => m.id !== MAIN && !m.isBusy)
  if (loafer !== undefined) {
    const mate = { ...loafer, id }

    return { crew: state.crew.map(m => (m === loafer ? mate : m)), mate, isNew: true }
  }
  const taken = new Set(state.crew.map(m => m.name))
  const free = ROSTER.find(r => !taken.has(r.name)) ?? {
    name: `Hand ${state.hires + 1}`,
    flaw: 'no file on record',
  }
  const mate: Mate = {
    id,
    ...free,
    hue: (state.crew.length * 67 + 20) % 360,
    station: 'cryo',
    isBusy: true,
  }

  return { crew: [...state.crew, mate], mate, isNew: true }
}

function logged(state: Ship, who: string, text: string, kind: EntryKind): Entry[] {
  const n = (state.log[state.log.length - 1]?.n ?? 0) + 1

  return [...state.log, { who, text, kind, n }].slice(-40)
}

function post(state: Ship, id: string, station: Station, isBusy: boolean): { next: Ship; mate: Mate } {
  const { crew, mate, isNew } = mateOf(state, id)
  const moved = { ...mate, station, isBusy }

  return {
    next: { ...state, crew: crew.map(m => (m.id === id ? moved : m)), hires: state.hires + (isNew ? 1 : 0) },
    mate: moved,
  }
}

export const register: Register = on => {
  // Status updates waiting for the crew's version. Lost at a reload, which is fine.
  let queue: { id: string; text: string }[] = []
  let isTranslating = false
  let misses = 0
  let lines = 0
  // Quarter-minutes with nothing to do, and how many insults that has produced.
  let idle = 0
  let quips = 0

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'lower-decks',
      description: 'Open the panel, or switch its setting: /lower-decks circuit, /lower-decks colony, /lower-decks freighter',
      argumentHint: '[freighter|colony|circuit]',
    })
    // The setting is the person's choice and outlives the session.
    const kept = await $.store.get('setting').catch(() => undefined)
    const setting: Setting = kept === 'colony' || kept === 'circuit' || kept === 'freighter' ? kept : DEFAULT
    const current = await update($, ship, (s): Ship =>
      s.setting === setting ? s : { ...s, setting, log: [{ who: 'Ship', text: VOICES[setting].start, kind: 'idle' }] },
    )
    void $.ui.open({ id: PANE, title: voiceOf(current).title })

    $.clock.every(1500, () => {
      const job = queue.shift()
      if (job === undefined || isTranslating) {
        return
      }
      isTranslating = true
      void translate(job).finally(() => {
        isTranslating = false
      })
    })

    $.clock.every(15000, () => {
      void loaf().catch(() => undefined)
    })

    async function loaf(): Promise<void> {
      const now = await read($, ship)
      if (now.alert !== 'allstop' || now.crew.some(m => m.isBusy)) {
        idle = 0

        return
      }
      idle += 1
      // First jab after half a minute, then every 45 seconds, then rarely.
      if (idle < 2 || idle % 3 !== 2 || (idle > 40 && idle % 12 !== 2)) {
        return
      }
      quips += 1
      const roll = Math.floor(Math.random() * 1000)
      await update($, ship, (s): Ship => {
        if (s.alert !== 'allstop' || s.crew.length < 2) {
          return s
        }
        const a = s.crew[(roll + quips) % s.crew.length]
        const others = s.crew.filter(m => m !== a)
        const b = others[(roll >> 3) % others.length]
        const banter = voiceOf(s).banter
        const quip = banter[(roll + quips * 7) % banter.length]
        if (a === undefined || b === undefined || quip === undefined) {
          return s
        }
        const text = quip.text.replace(/\{b\}/g, b.name).replace(/\{a\}/g, a.name)

        return {
          ...s,
          crew: s.crew.map(m => (m === a ? { ...m, station: quip.at ?? m.station } : m)),
          log: logged(s, a.name, text, 'idle'),
        }
      })
    }

    async function translate(job: { id: string; text: string }): Promise<void> {
      let line: string | undefined
      const voice = voiceOf(await read($, ship))
      if (voice.system !== '' && misses < 3) {
        try {
          const answer = await $.model.complete({
            model: MODEL,
            system: voice.system,
            prompt: clipLine(job.text, 700),
            maxTokens: 120,
            timeoutMs: 20000,
          })
          if (answer.isAnswered && answer.text.trim() !== '') {
            line = clipLine(answer.text.replace(/^["'\s]+|["'\s]+$/g, ''), 200)
            misses = 0
          } else {
            misses += 1
          }
        } catch {
          misses += 1
        }
      }
      // No model to do the voice: the memo goes up verbatim.
      const text = line ?? `${voice.memo}${clipLine(job.text, 120)}`
      await update($, ship, (s): Ship => {
        const who = s.crew.find(m => m.id === job.id)?.name ?? CHIEF.name

        return { ...s, log: logged(s, who, text, 'log') }
      })
    }

    return next(e)
  })

  on('command.run', { command: 'lower-decks' }, async ($, e) => {
    const asked = e.args.trim().toLowerCase()
    let state = await read($, ship)
    const isSetting = asked === 'colony' || asked === 'freighter' || asked === 'circuit'
    if (asked === 'colony' || asked === 'freighter' || asked === 'circuit') {
      await $.store.set('setting', asked)
      state = await update($, ship, (s): Ship => ({
        ...s,
        setting: asked,
        breachAt: undefined,
        alert: s.alert === 'breach' ? 'underway' : s.alert,
        log: [{ who: 'Ship', text: VOICES[asked].start, kind: 'idle' }],
      }))
    }
    const voice = voiceOf(state)
    const opened = await $.ui.open({ id: PANE, title: voice.title })
    const unknown = asked !== '' && !isSetting ? ` No setting called "${asked}": the settings are freighter, colony and circuit.` : ''

    return {
      text:
        (opened.isPlaced
          ? `${voice.title} panel opened.`
          : `No side panel in this app (${opened.reason}), so ${voice.title} is drawn here and the log runs above the prompt.`) + unknown,
      isTextDisplayOnly: true,
    }
  })

  on('turn.start', async ($, e, next) => {
    try {
      const id = e.agentId ?? MAIN
      await update($, ship, (s): Ship => {
        const { next: moved, mate } = post(s, id, id === MAIN ? 'mess' : 'cryo', true)
        const voice = voiceOf(s)
        const text = id === MAIN ? pick(voice.orders, s.jobs + s.log.length) : voice.assigned.replace('{flaw}', mate.flaw)

        return { ...moved, alert: 'underway', breachAt: undefined, log: logged(moved, mate.name, text, id === MAIN ? 'bridge' : 'hire') }
      })
    } catch {
      // The panel never stands in the way of the work.
    }

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const id = e.agentId ?? MAIN
    const job = jobOf(String(e.tool), e as unknown as Record<string, unknown>)
    idle = 0
    lines += 1
    const n = lines
    try {
      await update($, ship, (s): Ship => {
        const { next: moved, mate } = post(s, id, job.station, true)

        return {
          ...moved,
          alert: 'underway',
          breachAt: undefined,
          jobs: moved.jobs + 1,
          log: logged(moved, mate.name, pick(voiceOf(moved).work[job.kind], n, job.subject), 'work'),
        }
      })
    } catch {
      // As above.
    }

    const ran = await next(e)

    if (('deny' in ran && ran.deny !== undefined) || ('isError' in ran && ran.isError === true)) {
      try {
        await update($, ship, (s): Ship => {
          const mate = s.crew.find(m => m.id === id)

          return {
            ...s,
            alert: 'breach',
            breachAt: job.station,
            breaches: s.breaches + 1,
            log: logged(s, mate?.name ?? CHIEF.name, voiceOf(s).isPlain ? `FAULT\t${labelOf(s, job.station).toLowerCase()}` : `${labelOf(s, job.station)}: ${pick(voiceOf(s).breach, s.breaches)}`, 'breach'),
          }
        })
      } catch {
        // As above.
      }
    }

    return ran
  })

  on('session.append', async ($, e, next) => {
    if (e.door === 'response') {
      const said = e.message.content
        .map(block => {
          const b = block as { type?: string; text?: unknown }

          return b.type === 'text' && typeof b.text === 'string' ? b.text : ''
        })
        .join(' ')
        .trim()
      if (said.length >= 16) {
        queue = [...queue, { id: e.agentId ?? MAIN, text: said }].slice(-3)
      }
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    try {
      const id = e.agentId ?? MAIN
      const isWrecked = e.reason === 'error' || e.reason === 'aborted'
      await update($, ship, (s): Ship => {
        if (id !== MAIN) {
          const name = s.crew.find(m => m.id === id)?.name ?? ''
          const { next: moved, mate } = post(s, id, homeOf(name), false)

          return { ...moved, log: logged(moved, mate.name, pick(voiceOf(s).off, s.log.length), 'idle') }
        }
        const text = pick(isWrecked ? voiceOf(s).wreck : voiceOf(s).idle, s.jobs + s.breaches)

        return {
          ...s,
          crew: s.crew.map(m => (m.id === MAIN || !m.isBusy ? { ...m, station: homeOf(m.name), isBusy: false } : m)),
          alert: 'allstop',
          breachAt: undefined,
          log: logged(s, 'Ship', text, 'idle'),
        }
      })
      if (id === MAIN) {
        $.ui.toast(voiceOf(await read($, ship)).toast)
      }
    } catch {
      // As above.
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const state = await read($, ship)
    const rows = e.viewport?.rows ?? 30
    const isGlance = e.props.placement === 'widget'
    const room = isGlance ? 2 : Math.max(4, Math.min(14, rows - 22))

    if (e.surface === 'terminal') {
      return <Box flexDirection="column">{plain(state, room, Text)}</Box>
    }
    const { Svg } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" gap={1}>
        <Svg {...picture(state, (await $.clock.now()) / 1000)} />
        {!isGlance && (state.setting ?? DEFAULT) === 'freighter' && (
          <Text dimColor size="caption">
            {state.crew.map(m => `${m.name} (${m.flaw})`).join(' · ')}
          </Text>
        )}
        {!voiceOf(state).isPlain && <Box flexDirection="column">{logRows(state, room, Text)}</Box>}
      </Box>
    )
  })

  // Where no surface seats the pane, /lower-decks draws the ship in the transcript.
  on('ui.render', { component: 'CommandOutput', props: { command: 'lower-decks' } }, async ($, e) => {
    const { Box, Text } = $.ui.resolve(e)
    const state = await read($, ship)
    const note = <Text dimColor>{e.props.text}</Text>

    if (e.surface === 'terminal') {
      return (
        <Box flexDirection="column">
          {note}
          {plain(state, 6, Text)}
        </Box>
      )
    }
    const { Svg } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" gap={1}>
        {note}
        <Svg {...picture(state, (await $.clock.now()) / 1000)} />
        <Box flexDirection="column">{logRows(state, 6, Text)}</Box>
      </Box>
    )
  })

  // And the newest log line rides above the prompt while the pane is not on screen.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const panes = await $.ui.panes()
    if (e.props.hasSurvey || panes.some(p => p.id === PANE && p.isPlaced && p.isShown)) {
      return next(e)
    }
    const { Box, Text } = $.ui.resolve(e)
    const state = await read($, ship)
    const last = state.log[state.log.length - 1]

    return (
      <Box>
        <Text color={tone(state)} bold>
          {voiceOf(state).title}{' '}
        </Text>
        <Text dimColor wrap="truncate-end">
          {last === undefined ? banner(state) : said(state, `${last.who}: ${last.text}`)}
        </Text>
      </Box>
    )
  })
}

type TextTag = Elements['terminal']['Text']

function logRows(state: Ship, room: number, Text: TextTag) {
  return state.log
    .slice(-room)
    .reverse()
    .map((entry, i) => (
      <Text dimColor={i > 0 && entry.kind !== 'breach'} color={entry.kind === 'breach' ? 'error' : undefined}>
        <Text bold>{said(state, entry.who)}:</Text> {said(state, entry.text)}
      </Text>
    ))
}

function plain(state: Ship, room: number, Text: TextTag) {
  return [
    <Text bold color={tone(state)}>
      {banner(state)}
    </Text>,
    ...state.crew.map(m => (
      <Text dimColor={!m.isBusy}>
        {m.isBusy ? '>' : 'z'} {said(state, m.name)}
        {(state.setting ?? DEFAULT) === 'freighter' ? ` (${m.flaw})` : ''}: {labelOf(state, m.station).toLowerCase()}
      </Text>
    )),
    <Text dimColor>
      jobs {state.jobs} / breaches {state.breaches} / hires {state.hires}
    </Text>,
    <Text> </Text>,
    ...logRows(state, room, Text),
  ]
}

function banner(state: Ship): string {
  return voiceOf(state).banners[state.alert]
}

function said(state: Ship, text: string): string {
  return alias(state.setting ?? DEFAULT, text).replace(/\t/g, '  ')
}

function picture(state: Ship, now: number): { source: string; alt: string } {
  const setting = state.setting ?? DEFAULT
  if (setting === 'freighter') {
    return { source: scene(state, VOICES.freighter.title), alt: describe(state) }
  }

  return setting === 'colony'
    ? { source: colonyScene(state, now), alt: colonyDescribe(state) }
    : { source: circuitScene(state, now), alt: circuitDescribe(state) }
}

function tone(state: Ship): 'error' | 'warning' | 'success' {
  return state.alert === 'breach' ? 'error' : state.alert === 'allstop' ? 'warning' : 'success'
}
