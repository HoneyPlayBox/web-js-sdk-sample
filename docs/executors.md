# Execution Modes

Each connector owns read-only Immediate, Queue and Funscript executor properties.
Use these instances, rather than constructing executor classes yourself.
All device lifecycle operations belong to connector.

## Immediate

```javascript
await connector.Immediate.execute(toyId, {
  function: HoneyPlayBox.OpenSDK.ToyFunctions.Vibrate,
  value: 50, duration: 1000
});
await connector.Immediate.stop(toyId);
```

Execute accepts a command object or an array for one toy. It validates input,
replaces previous scheduling for that toy, drains in-flight writes and sends.
It does not wait for the device's physical action to finish.
Stop replaces scheduling and sends a stop request to that toy.

## Connector Queue

```javascript
await connector.Queue.execute(toyAId, command);
await connector.Queue.execute([toyAId, toyBId], command);
await connector.Queue.execute([
  { ...commandA, toyId: toyAId },
  { ...commandB, toyId: toyBId }
]);
```

Each call appends one unit to the same connector FIFO. Targets within a unit
are dispatched concurrently; the next unit waits for all target writes and
duration waits. A Toy-local queue is a separate owner, not this FIFO.
See [Queues](./queues.md) for the complete contract.

## Funscript

```javascript
await connector.Funscript.load(script);
await connector.Funscript.start();
await connector.Funscript.pause();
await connector.Funscript.resume();
```

The script matches supported tracks to connected toys. Playback examples omit
toyId and control the matched group. Loading alone does not take output ownership.
See [Funscript](./funscript.md) for input formats, controls and eligible states.

## Replacement Rules

| Operation | Effect |
| --- | --- |
| Immediate.execute(toyId, commands) | Cancel that toy's old playback and both queue schedules, then send. |
| Immediate.stop(toyId) | Cancel the same scheduling and send stop to that toy. |
| Queue.execute(...) | Enqueue only; no immediate output replacement. |
| A connector queue target starts sending | Interrupt that toy's Funscript; preserve its Toy-local queue records. |
| Funscript.load(script) | Load and match; do not clear queues or start output. |
| Funscript.start/resume/restart | Replace scheduling for participating toys before playback. |
| Queue.clear() | Cancel connector records and waits; no stop request. |
| toy.clearCommandQueue() | Cancel only local queue records and waits; no stop request. |

Replacing a toy cancels whole connector units containing it, including units
with other targets; unrelated connector units remain. Queue clear/replacement
cannot undo output already sent. It does not send an extra stop solely because
the execution mode changed. Stop every required toy explicitly when needed.

Do not mix legacy mode-based playback calls and executor calls on the same toy
without intentionally handling replacement. For per-toy queued commands, use
the documented Toy-local queue API in [Queues](./queues.md).

## Command Shape

Use enum values for function and optional target:

```javascript
const command = {
  function: HoneyPlayBox.OpenSDK.ToyFunctions.Vibrate,
  target: HoneyPlayBox.OpenSDK.Spots.C,
  value: 50,
  duration: 1000
};
```

Omit target to use the toy's function defaults. Value-based commands use value;
Position uses centerPosition, amplitude and speed. Function support and bounds
depend on the selected toy. Duration is in milliseconds. For continuous actions,
zero requests continued output, not stop; it adds no queue wait.
Execution status describes SDK scheduling and writes, not sensor confirmation.
