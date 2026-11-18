import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'lower-decks',
  component: 'Pane',
  requestId: 'lower-decks',
  props: {
    title: 'MV Sunk Cost',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

test('a tool call puts the chief to work, and a failure is a breach', async ($, on) => {
  on('clock.now', () => ({ value: 0 }))
  on('tool.call', (_, e) =>
    String(e.tool) === 'Bash' ? { result: {}, text: 'boom', isError: true } : { result: {} },
  )

  await $.tool.call({ tool: 'Read', file_path: '/a/b/manifest.txt' })

  for (const surface of ['terminal', 'desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect((await ui.find({ type: 'Text', text: /manifest\.txt/ })) !== undefined).toBe(true)
    await ui.unmount()
  }

  await $.tool.call({ tool: 'Bash', command: 'npm test' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /HULL BREACH/ })) !== undefined).toBe(true)
  expect((await ui.find({ type: 'Text', text: /REACTOR:/ })) !== undefined).toBe(true)
  await ui.unmount()
})

test('a subagent is hired by name and the picture is drawn', async ($, on) => {
  on('clock.now', () => ({ value: 0 }))
  on('tool.call', () => ({ result: {} }))

  await $.tool.call({ tool: 'Grep', pattern: 'TODO', agentId: 'a1' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const svg = await ui.find({ type: 'Svg' })
  expect(svg !== undefined).toBe(true)
  expect((await ui.find({ type: 'Text', text: /Gary:/ })) !== undefined).toBe(true)
  await ui.unmount()
})

test('with no pane on screen the log rides above the prompt', async ($, on) => {
  on('tool.call', () => ({ result: {} }))
  on('ui.panes', () => ({ value: [] }))

  await $.tool.call({ tool: 'Read', file_path: '/a/b/manifest.txt' })

  const ui = await $.ui.mount({
    plugin: 'lower-decks',
    surface: 'desktop',
    component: 'AbovePrompt',
    requestId: 'band',
    props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 3, bodyColumns: 80, scroll: { offset: 0, bodyRows: 3 }, view: {} },
  })
  expect((await ui.find({ type: 'Text', text: /manifest\.txt/ })) !== undefined).toBe(true)
  await ui.unmount()
})

test('the colony setting draws the swarm and renames the crew', async ($, on) => {
  on('tool.call', () => ({ result: {} }))
  on('command.register', () => ({ value: { command: 'lower-decks' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('command.run', () => ({}))
  on('clock.now', () => ({ value: 0 }))
  on('store.set', () => ({ value: undefined }))

  await $.command.run({ command: 'lower-decks', args: 'colony' } as never)
  await $.tool.call({ tool: 'Read', file_path: '/a/b/manifest.txt' })

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /0x00:/ })) !== undefined).toBe(true)
  expect((await ui.find({ type: 'Text', text: /Hask/ })) === undefined).toBe(true)
  await ui.unmount()
})
