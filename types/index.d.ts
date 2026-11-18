export type Station =
  | 'bridge'
  | 'comms'
  | 'sensors'
  | 'mess'
  | 'reactor'
  | 'engine'
  | 'workshop'
  | 'hold'
  | 'cryo'

export type Mate = {
  id: string
  name: string
  flaw: string
  hue: number
  station: Station
  isBusy: boolean
}

export type EntryKind = 'work' | 'breach' | 'bridge' | 'idle' | 'hire' | 'log'

export type Entry = { who: string; text: string; kind: EntryKind }

export type Alert = 'underway' | 'allstop' | 'breach'

export type Setting = 'freighter' | 'colony'

export type Ship = {
  setting?: Setting
  crew: Mate[]
  log: Entry[]
  alert: Alert
  breachAt?: Station
  jobs: number
  breaches: number
  hires: number
}

declare module 'claude-code' {
  interface PluginState {
    'lower-decks': { ship: Shaped<Ship> }
  }
}
