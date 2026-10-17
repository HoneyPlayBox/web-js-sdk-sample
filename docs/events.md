# Events And Feedback

Register listeners on the connector to observe every toy it manages.
Subscription helpers return an unsubscribe function. Standard EventTarget
listeners receive data on event.detail; helper callbacks receive the detail
directly.

```javascript
const offFeedback = connector.onFeedback(feedback => {
  if (feedback.kind === "battery") updateBattery(feedback.toyId, feedback.value);
  else if (feedback.kind === HoneyPlayBox.OpenSDK.DeviceNotificationType.pressure)
    updatePressure(feedback.toyId, feedback.value);
});
const offQueue = connector.onQueueChange(state => {
  if (state.scope === "connector") renderConnectorQueue(state.queue);
  else renderToyQueue(state.toyId, state.queue);
});
const offPlayback = connector.onFunscriptState(state => {
  renderPlayback(state.toyId, state);
});
const onDisconnect = event => updateConnection(event.detail.toyId, false);
connector.addEventListener("disconnect", onDisconnect);

// When disposing the UI:
offFeedback();
offQueue();
offPlayback();
connector.removeEventListener("disconnect", onDisconnect);
```

Rendering functions belong to your application. Keep subscriptions alive while
using the UI; the final lines illustrate later cleanup, not immediate setup.

## Event Catalog

| Event | Meaning |
| --- | --- |
| discover | Discovery results are available. |
| connect | Initial connection or reconnect state changed. |
| disconnect | A toy disconnected. |
| command | A command or stop request was sent. |
| feedback | A structured device reading arrived. |
| queuechange | A connector or local queue changed. |
| funscriptstate | Playback state, matching or progress changed. |
| error | An asynchronous SDK operation failed. |

Catch rejected method calls separately. Do not assume every rejected call also
emits error, or that every background failure rejects the earlier enqueue call.

## Connection

Connect status values include connected, reconnecting, reconnected,
reconnectError and reconnectStopped. Details identify toyId and may include
attempt, delay, message and time. There are no separate reconnect event names.

A disconnect detail includes identity and connection state, and may describe
whether the disconnect was manual or automatic reconnect is enabled. Render
disconnection immediately; do not keep showing connected while retries run.

## Feedback

```javascript
const batteryExample = {
  toyId: "toy-id",
  name: "Toy Name",
  kind: "battery",
  value: 80,
  unit: "percent",
  time: Date.now()
};
const pressureExample = {
  toyId: "toy-id",
  name: "Toy Name",
  kind: HoneyPlayBox.OpenSDK.DeviceNotificationType.pressure,
  value: 15.5,
  unit: "value",
  time: Date.now()
};
```

The public shape is toyId, name, kind, value, unit and time. Value may be null or
structured depending on the reading; do not force all feedback to a percentage.
Pressure and battery are separate kinds. Battery is not a member of
DeviceNotificationType; use the battery kind shown above.
There are no responseStatus or incomplete fields in public feedback.
Treat unknown kinds gracefully. Feedback availability depends on the toy.

## Queue Changes

| Field | Meaning |
| --- | --- |
| scope | connector for the shared FIFO, toy for a Toy-local queue. |
| action | Operation that changed the queue. |
| commandId | Affected unit identifier, when applicable. |
| toyId | One target, null for a multi-toy connector unit, or optional for clear. |
| toyIds | Target list on connector unit events. |
| queuedCommandCount | Number of remaining records, including a running record. |
| queue | Current snapshot for this owner. |
| time | Unix epoch milliseconds. |
| reason / message / failures | Optional cancellation or error context. |

Connector actions are enqueue, start, complete, failed, remove and clear.
Toy-local events also include modeChange. A connector mode-change cleanup is
reported as clear with a reason, not a connector modeChange action.

Each connector entry includes commandId, toyId, toyIds, name, commands,
commandCount, queuedAt, position, status and scope. Commands include their
target toyId. Local entries identify their one toy and do not need toyIds.
Status is waiting or running. Position refers to the owner's complete queue.

Connector snapshots contain the entire FIFO, even if an event concerns one toy.
Direct toy.onQueueChange receives only local events; connector.onQueueChange
receives both scopes. Start indicates scheduling ownership, not physical motion.
See [Queues](./queues.md) for precise completion and cancellation rules.

## Playback State

Use HoneyPlayBox.OpenSDK.FunscriptState values when comparing state:
empty, ready, playing, paused, stopped, ended, disconnected and error.

| Field | Meaning |
| --- | --- |
| toyId / name | Reporting toy. |
| state / reason | State and cause of this update. |
| positionMs / durationMs | Timeline position and total script duration. |
| playbackRate | Speed multiplier. |
| progress | Timeline fraction from zero to one. |
| actionCount | Number of normalized actions on matched tracks. |
| tracks | Matching results: trackId, function, motor, target, matched, reason. |
| lastSentAt | Last successful sample write time, or null. |
| time | Event time in Unix epoch milliseconds. |
| driftMs | Applied position adjustment when applicable. |
| message | Failure description when applicable. |

Each participant emits its own status. Group control returns do not replace the
need for events. Script progress and successful writes do not prove that a
physical target position was reached.

## Command Results

Command events contain public input-oriented command data and identity, with
commandCount and time, and may include a queue commandId or action marker.
They are not device-completion events. A multi-toy unit can produce one command
event per target; use queuechange to observe whole-unit completion.
