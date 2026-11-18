import { atom, read, update } from 'claude-code'
import type { Elements, Register } from 'claude-code'

import type { Entry, EntryKind, Mate, Ship, Station } from '../types'
import { describe, roomLabel, scene } from './scene'
import {
  BREACH,
  CHIEF,
  IDLE,
  LOG_SYSTEM,
  OFF,
  ORDERS,
  ROSTER,
  SHIP,
  WRECK,
  clipLine,
  jobOf,
  pick,
} from './voice'

const PANE = 'lower-decks'
const MAIN = 'main'
const MODEL = 'claude-haiku-5-5'

const EMPTY: Ship = {
  crew: [{ id: MAIN, ...CHIEF, hue: 200, station: 'mess', isBusy: false }],
  log: [{ who: 'Ship', text: 'Shift started. Coffee is a rumour.', kind: 'idle' }],
  alert: 'allstop',
  jobs: 0,
  breaches: 0,
  hires: 0,
}

const ship = atom({ plugin: 'lower-decks', key: 'ship' } as const, EMPTY, {
  shape: 'ship-1',
})

function mateOf(state: Ship, id: string): { crew: Mate[]; mate: Mate; isNew: boolean } {
  const found = state.crew.find(m => m.id === id)
  if (found !== undefined) {
    return { crew: state.crew, mate: found, isNew: false }
  }
  const taken = new Set(state.crew.map(m => m.name))
  const free = ROSTER.find(r => !taken.has(r.name)) ?? {
    name: `Hand ${state.hires + 1}`,
    flaw: 'no file on record',
  }
  const mate: Mate = {
    id,
    ...free,
    hue: (state.hires * 67 + 20) % 360,
    station: 'cryo',
    isBusy: true,
  }
  // Nine fit on the ship: the longest-idle hand goes back in a pod.
  const kept = state.crew.length >= 9 ? dropIdle(state.crew) : state.crew

  return { crew: [...kept, mate], mate, isNew: true }
}

function dropIdle(crew: Mate[]): Mate[] {
  const gone = crew.find(m => m.id !== MAIN && !m.isBusy) ?? crew.find(m => m.id !== MAIN)

  return crew.filter(m => m !== gone)
}

function logged(state: Ship, who: string, text: string, kind: EntryKind): Entry[] {
  return [...state.log, { who, text, kind }].slice(-40)
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

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'lower-decks',
      description: `Open the ${SHIP} crew panel`,
    })
    void $.ui.open({ id: PANE, title: SHIP })

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

    async function translate(job: { id: string; text: string }): Promise<void> {
      let line: string | undefined
      if (misses < 3) {
        try {
          const answer = await $.model.complete({
            model: MODEL,
            system: LOG_SYSTEM,
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
      const text = line ?? `Memo from upstairs, verbatim: ${clipLine(job.text, 120)}`
      await update($, ship, (s): Ship => {
        const who = s.crew.find(m => m.id === job.id)?.name ?? CHIEF.name

        return { ...s, log: logged(s, who, text, 'log') }
      })
    }

    return next(e)
  })

  on('command.run', { command: 'lower-decks' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: SHIP })

    return {
      text: opened.isPlaced
        ? `${SHIP} crew panel opened.`
        : `No side panel in this app (${opened.reason}), so the ${SHIP} is drawn here and the log runs above the prompt.`,
      isTextDisplayOnly: true,
    }
  })

  on('turn.start', async ($, e, next) => {
    try {
      const id = e.agentId ?? MAIN
      await update($, ship, (s): Ship => {
        const { next: moved, mate } = post(s, id, id === MAIN ? 'mess' : 'cryo', true)
        const text = id === MAIN ? pick(ORDERS, s.jobs + s.log.length) : `Thawed and assigned. ${mate.flaw}.`

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
          log: logged(moved, mate.name, pick(job.lines, n, job.subject), 'work'),
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
            log: logged(s, mate?.name ?? CHIEF.name, `${roomLabel(job.station)}: ${pick(BREACH, s.breaches)}`, 'breach'),
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
          const { next: moved, mate } = post(s, id, 'mess', false)

          return { ...moved, log: logged(moved, mate.name, pick(OFF, s.log.length), 'idle') }
        }
        const text = pick(isWrecked ? WRECK : IDLE, s.jobs + s.breaches)

        return {
          ...s,
          crew: s.crew.map(m => (m.id === MAIN ? { ...m, station: 'mess' as const, isBusy: false } : m)),
          alert: 'allstop',
          breachAt: undefined,
          log: logged(s, 'Ship', text, 'idle'),
        }
      })
      if (id === MAIN) {
        $.ui.toast(`${SHIP}: all stop. Your move, Captain.`)
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
        <Svg source={scene(state, SHIP)} alt={describe(state)} />
        {!isGlance && (
          <Text dimColor size="caption">
            {state.crew.map(m => `${m.name} (${m.flaw})`).join(' · ')}
          </Text>
        )}
        <Box flexDirection="column">{logRows(state, room, Text)}</Box>
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
        <Svg source={scene(state, SHIP)} alt={describe(state)} />
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
          {SHIP}{' '}
        </Text>
        <Text dimColor wrap="truncate-end">
          {last === undefined ? banner(state) : `${last.who}: ${last.text}`}
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
        <Text bold>{entry.who}:</Text> {entry.text}
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
        {m.isBusy ? '>' : 'z'} {m.name} ({m.flaw}): {roomLabel(m.station).toLowerCase()}
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
  return state.alert === 'breach'
    ? 'HULL BREACH. AGAIN.'
    : state.alert === 'allstop'
      ? 'ALL STOP. Awaiting the bridge.'
      : 'Underway. Allegedly.'
}

function tone(state: Ship): 'error' | 'warning' | 'success' {
  return state.alert === 'breach' ? 'error' : state.alert === 'allstop' ? 'warning' : 'success'
}
