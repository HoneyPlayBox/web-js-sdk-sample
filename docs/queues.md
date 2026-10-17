# Queues

## Two Independent Owners

| Queue | Submit | Inspect | Clear |
| --- | --- | --- | --- |
| Connector FIFO | connector.Queue.execute(...) | connector.Queue.getItems() | connector.Queue.clear() |
| Toy-local queue | toy.sendCommand(...) in queue mode | toy.getCommandQueue() | toy.clearCommandQueue() |

The connector has one FIFO across all its toys. Each Toy also has its own queue.
An entry never belongs to both. Clearing or removing from one owner does not
clear the other. Complete units targeting the same toy are serialized to prevent
overlapping queued output. Local queues on different toys can run concurrently
with each other and with the connector queue.

## Submission Forms

```javascript
const command = {
  function: HoneyPlayBox.OpenSDK.ToyFunctions.Vibrate,
  value: 80, duration: 500
};
// C: one toy, one unit.
const unitC = await connector.Queue.execute(toyAId, command);
// D: the same command for several toys, still one unit.
const unitD = await connector.Queue.execute([toyAId, toyBId], command);
// E: different commands, one multi-toy unit.
const unitE = await connector.Queue.execute([
  { toyId: toyAId, function: HoneyPlayBox.OpenSDK.ToyFunctions.Vibrate, value: 40, duration: 1000 },
  { toyId: toyBId, function: HoneyPlayBox.OpenSDK.ToyFunctions.Vibrate, value: 60, duration: 2000 }
]);
```

The explicit-target forms accept either a command or an array. The single-argument
form requires toyId on every command. Duplicate target IDs are deduplicated.
An embedded toyId conflicting with an explicit target rejects the call.
Targets and commands are validated before enqueue; invalid input creates no
partial unit. Each call creates exactly one commandId and one queue entry.

Awaiting execute confirms enqueue only. Its result includes commandId,
status (queued), toyIds, commands, queuedAt and time. Keep commandId to identify
the unit, not the individual toy.

## A Before B

Within a unit, commands are grouped by toyId and submitted together for that toy.
Different targets are dispatched concurrently. Each target starts its duration
wait after its write completes:

```text
Unit completion = max(each target send completion + its longest duration)
Next unit starts after the current unit completes.
```

Ignoring transport delay, C above waits 500ms, then D waits until both targets
have finished their own 500ms waits, then E starts. E waits 2000ms if both target
writes finish together. A slower write shifts that target's completion time.

Toy-local reservations can delay individual target writes. Concurrent dispatch
does not guarantee simultaneous physical starts. No device-completion
acknowledgement is implied by an elapsed duration.

Duration zero adds no wait after sending. A continuous action may therefore
overlap a later unit. It is not a stop instruction. The running entry remains
visible until the unit completes, fails or is cancelled. Normal completion
removes only that entry, not the remaining FIFO.

If a target fails, successful targets still finish their write and duration waits.
The unit then emits failed, including per-target failures, and the worker
continues with the next unit. Failed units are not automatically retried.

## Inspect And Remove

```javascript
const allUnits = connector.Queue.getItems();
const involvingA = connector.Queue.getItems(toyAId);
// A separate user action; only succeeds while E is still waiting.
const removed = connector.Queue.remove(unitE.commandId);
```

Remove returns false for running, completed or unknown entries. The optional
remove(toyId, commandId) form checks membership first.

A filtered view returns whole units containing the toy, not just commands for
that toy. Multi-toy entries have toyId: null, a toyIds array, and toyId on each
command. Position is the entry's position in the complete connector queue.
Running marks worker ownership, not proof that every target has started.

## Clear And Cancellation

```javascript
// Alternative operations, normally triggered by separate user actions:
const removedCount = connector.Queue.clear();
const affectedCount = connector.Queue.clear(toyAId);
```

Clear returns the number of removed units. It includes running and waiting
records, cancels remaining scheduling waits and prevents unsent work where
possible. In-flight writes can still finish. Already-sent output is not undone,
and clear does not send stop.

Filtered clear cancels every whole unit containing that toy, including the
unit's other targets. Disconnect and execution replacement use the same
whole-unit rule. Unrelated units remain.

To cancel scheduling and stop one toy:

```javascript
await connector.Immediate.stop(toyAId);
```

That call does not stop the other toys in cancelled multi-toy units. Send an
explicit stop to each required toy. See [Execution Modes](./executors.md).

## Toy-Local Queue

```javascript
const toy = connector.getToy(toyAId);
toy.setCommandMode(HoneyPlayBox.OpenSDK.ToyCommandMode.queue);
await toy.sendCommand({
  function: HoneyPlayBox.OpenSDK.ToyFunctions.Vibrate,
  value: 40, duration: 1000
});
await toy.sendCommand({
  function: HoneyPlayBox.OpenSDK.ToyFunctions.Vibrate,
  value: 70, duration: 500
});
const localUnits = toy.getCommandQueue();
```

Use toy.removeCommand(commandId) for a waiting local entry, or
toy.clearCommandQueue() to clear local scheduling without stop. Arrays remain
one local unit. Changing the Toy's command mode clears its local scheduling.
The local worker stops its processing pass on a send failure; later entries
remain and a later submission can restart processing. This differs from the
connector worker's continue-after-failure behavior.

Legacy connector.getCommandQueue / clearCommandQueue / removeCommand delegate
to the connector FIFO. They do not access Toy-local queues. Connector.sendCommand
uses the connector FIFO when the target is in queue mode; Toy.sendCommand uses
the local queue. Prefer the explicit executor APIs for connector submissions.

## Observe Changes

```javascript
const unsubscribe = connector.onQueueChange(state => {
  if (state.scope === "connector") renderConnectorQueue(state.queue);
  else renderToyQueue(state.toyId, state.queue);
});
```

Rendering functions belong to the application. Connector events contain the
whole FIFO; Toy events contain that toy's local queue.
See [Events](./events.md) for action names and payload fields.
