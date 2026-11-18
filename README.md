# lower-decks

A side panel for Claude Code that shows the agents at work as the underpaid lower-deck crew of the freighter MV Sunk Cost. Every tool call sends a crew member to a station (hold, sensors, workshop, engines, reactor, comms, cryo), failures are hull breaches, and a ship's log narrates the work with as much sarcasm as the crew can afford. When Claude is waiting on you, the engines cut and the banner reads ALL STOP.

Status updates are rewritten in the crew's voice by a small model call each; tool calls use canned lines.

## Settings

Two settings, switched with a command and remembered across sessions:

- `/lower-decks freighter`: the crew of the MV Sunk Cost.
- `/lower-decks colony`: a colony of small faceless units in tunnels and chambers, with field notes in place of a ship's log.

## Install

At the prompt of a terminal session:

```
/plugin install lower-decks --marketplace smckays/lower-decks
```

From a shell:

```
claude plugin install lower-decks --marketplace smckays/lower-decks
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `smckays/lower-decks`, then Add plugin.

Answer `y` to add the marketplace, then pick the user scope so the panel loads in every session. Type `/lower-decks` to reopen the panel if you close it.
