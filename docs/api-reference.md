# API Reference

All names below are under `HoneyPlayBox.OpenSDK`. Load the browser script as
shown in [Quick Start](./quick-start.md).

## Public Objects

| Object | Purpose |
| --- | --- |
| ToyConnector | BLE connector by default. |
| HIDToyConnector | Connector fixed to a supported USB HID gateway. |
| Toy | Connected device properties and toy-local operations. |
| ImmediateExecutor | Immediate execution; use connector.Immediate. |
| QueueExecutor | Shared FIFO; use connector.Queue. |
| FunscriptExecutor | Script playback; use connector.Funscript. |
| ToyExecutorBase | Shared execution infrastructure, not a device-lifecycle API. |
| createToyConnector(options) | Factory for ToyConnector. |
| isBleSupported() | Asynchronous BLE capability check. |
| isHidSupported() | Asynchronous HID capability check. |

## Connector Options

| Option | Default | Meaning |
| --- | --- | --- |
| autoReconnect | true | Retry unexpected BLE disconnections. |
| reconnectMaxAttempts | 5 | Maximum retry attempts; zero disables retries. |
| reconnectDelayMs | 1000 | Initial reconnect delay in milliseconds. |
| reconnectFailurePauseMs | 2000 | Pause after a failed retry. |
| reconnectMaxDelayMs | 10000 | Maximum reconnect delay. |
| commandMode | ToyCommandMode.normal | Initial mode for Toy-level command calls. |

HID does not use automatic BLE reconnect. Product metadata is internal, not
a caller-supplied option. Capability checks do not authorize devices.

## Connector Lifecycle

| Method | Result / behavior |
| --- | --- |
| scan() | Promise of discovered toy summaries; call from a user gesture. |
| connectHid() | Promise of { connected: true } after adapter authorization and opening; HID transport only. Does not scan or connect toys. |
| isHidConnected() | Synchronous boolean indicating whether the adapter handle is open; not a toy connection check. |
| connect(toyId) | Promise of a Toy. |
| connect(toyIds) | Promise of Toys in input order; no rollback on partial failure. |
| getConnectedToys() | Registered Toy array; inspect connected during reconnect. |
| getToy(toyId) | Registered Toy or null. |
| readBattery(toyId) | Promise of battery value when available. |
| disconnect(toyId) | Manually disconnect; no automatic retry. |
| onFeedback(callback) | Subscribe to structured readings; returns unsubscribe. |
| onQueueChange(callback) | Subscribe to both queue scopes; returns unsubscribe. |
| onFunscriptState(callback) | Subscribe to per-toy playback status; returns unsubscribe. |

These methods belong to connector, not its executors. BLE and HID share them.

connectHid rejects on BLE transport, permission cancellation or opening failure.
Repeated calls reuse an open adapter. HID scan retains automatic authorization
for compatibility when no adapter is open. New interfaces should separate the
Connect HID and Discover actions. See [HID And Page Lifecycle](./hid-lifecycle.md).

The sample's Disconnect HID button and disconnectHidSafely helper are not
public connector methods. Do not call connector.disconnectHid().

## Immediate

| Method | Behavior |
| --- | --- |
| execute(toyId, commandOrArray) | Replace scheduling for the toy and send one unit. |
| stop(toyId) | Replace scheduling and explicitly stop the toy. |

Specify toyId for predictable multi-toy use. Arrays here target the specified
toy, not different toys. See [Execution Modes](./executors.md).

## Connector Queue

| Method | Behavior |
| --- | --- |
| execute(toyId, commandOrArray) | Enqueue one single-toy unit. |
| execute(toyIds, commandOrArray) | Enqueue one unit sending the same commands to all targets. |
| execute(commandOrArray) | Enqueue one unit; every command must carry toyId. |
| getItems() | Entire connector FIFO snapshot. |
| getItems(toyId) | Whole units containing that toy. |
| remove(commandId) | Remove a waiting unit; return boolean. |
| remove(toyId, commandId) | Check membership, then remove the whole waiting unit. |
| clear() | Cancel all connector units; return removed unit count. |
| clear(toyId, reason) | Cancel whole units containing that toy; reason defaults to clear. |

Execute resolves after enqueue, not completion. Filtered clear is whole-unit
cancellation, not partial target removal. Clear sends no stop.
See [Queues](./queues.md) for authoritative timing and failure behavior.

## Funscript

Main signatures control the matched group without a toy ID.

| Method | Behavior |
| --- | --- |
| load(source, options) | Load object, JSON text or HTTP/HTTPS URL; return JSON text. |
| start() | Start from zero in ready, stopped or ended state. |
| pause() | Freeze playback and stop output. |
| resume() | Resume only paused eligible participants. |
| restart() | Restart the loaded timeline from zero. |
| stop() | Stop output, reset position, retain script. |
| seek(positionMs) | Absolute timeline adjustment. |
| jump(offsetMs) | Relative timeline adjustment. |
| setPlaybackRate(rate) | Set 0.1 through 4. |
| synchronizeTime(timeMs) | Align with media time in milliseconds. |
| getStatus() | Array of participant statuses. |
| getDocument(toyId) | Detached original document for one toy, or null. |

Control operations return promises of status arrays; getStatus is synchronous.
Optional explicit-ID overloads retain single-toy control. See
[Funscript](./funscript.md) for matching, options, state restrictions and errors.

## Commands

| Field | Meaning |
| --- | --- |
| function | ToyFunctions value; defaults to ToyFunctions.Vibrate. |
| value | Value for a value-based function, constrained by the toy's limits. |
| duration | Requested milliseconds; defaults to zero. |
| durationMs | Compatibility alias for duration. |
| target | Optional Spots value; omit to use configured function defaults. |
| centerPosition | Position command center. |
| amplitude | Position command amplitude. |
| speed | Position command speed. |
| toyId | Required in the Queue single-argument form; otherwise explicit target identifies the toy. |

Zero duration is not stop. For continuous actions it requests output until stopped
or superseded; it contributes no queue wait. Device capabilities and timing vary.

```javascript
await connector.Immediate.execute(toyId, {
  function: HoneyPlayBox.OpenSDK.ToyFunctions.Position,
  centerPosition: 50,
  amplitude: 30,
  speed: 5,
  duration: 1000
});
```

Use supported functions and optional spot enums, not raw motor indexes, in new
application commands. Legacy vibration/strength/motor fields remain compatibility
inputs rather than the recommended command shape.

## Toy

Properties include toyId, name, avatar, features, connected, commandMode,
motorCount and queuedCommandCount. Use name for display. Do not infer connection
state from the presence of a Toy in the connector registry.

| Toy method | Behavior |
| --- | --- |
| setCommandMode(mode) | Select local command mode; changing mode clears local scheduling without stop. |
| sendCommand(commandOrArray) | In queue mode, append one local unit; otherwise send according to local mode. |
| getCommandQueue() | Snapshot of local units, including running. |
| removeCommand(commandId) | Remove a waiting local unit. |
| clearCommandQueue() | Clear local scheduling without stop. |
| onQueueChange(callback) | Local queue events only. |
| onFeedback(callback) | This toy's structured readings. |
| onFunscriptState(callback) | This toy's playback state. |
| stopCommand() | Send stop; not a replacement for cancelling all scheduling. |
| readBatteryLevel() | Read this toy's battery when available. |
| disconnect() | Manually disconnect this toy. |

Prefer connector.Immediate.stop(toyId) when scheduling must be cancelled too.
Do not confuse Toy-local queues with the connector FIFO.

## Enums

Always reference enum members in application code.

| ToyFunctions member | Meaning |
| --- | --- |
| HoneyPlayBox.OpenSDK.ToyFunctions.Vibrate | Vibration. |
| HoneyPlayBox.OpenSDK.ToyFunctions.Rotate | Rotation. |
| HoneyPlayBox.OpenSDK.ToyFunctions.Oscillate | Reciprocating or swinging movement. |
| HoneyPlayBox.OpenSDK.ToyFunctions.Constrict | Constriction, squeezing or pump pressure. |
| HoneyPlayBox.OpenSDK.ToyFunctions.Spray | Spray output. |
| HoneyPlayBox.OpenSDK.ToyFunctions.Temperature | Heating or cooling level. |
| HoneyPlayBox.OpenSDK.ToyFunctions.Led | LED brightness. |
| HoneyPlayBox.OpenSDK.ToyFunctions.Position | Movement to a target position. |
| HoneyPlayBox.OpenSDK.ToyFunctions.HwPositionWithDuration | Hardware-timed movement to a target position. |

| Spots member | Meaning |
| --- | --- |
| HoneyPlayBox.OpenSDK.Spots.C | Clitoral region. |
| HoneyPlayBox.OpenSDK.Spots.G | Anterior vaginal wall region. |
| HoneyPlayBox.OpenSDK.Spots.A | Anterior fornix region. |
| HoneyPlayBox.OpenSDK.Spots.U | Region around the urethral opening. |
| HoneyPlayBox.OpenSDK.Spots.O | Deep vaginal/cervical region. |
| HoneyPlayBox.OpenSDK.Spots.P | Prostate region. |

Spots are selectors supported by individual products, not guarantees of anatomy
or sensation. A toy need not expose every spot.

| ToyCommandMode member | Meaning |
| --- | --- |
| HoneyPlayBox.OpenSDK.ToyCommandMode.immediate | Direct Toy-level command mode. |
| HoneyPlayBox.OpenSDK.ToyCommandMode.normal | Compatibility name for direct mode. |
| HoneyPlayBox.OpenSDK.ToyCommandMode.queue | Toy-local queue mode for Toy.sendCommand. |
| HoneyPlayBox.OpenSDK.ToyCommandMode.funscript | Toy-level script mode. Prefer connector.Funscript controls. |

| FunscriptState member | Meaning |
| --- | --- |
| HoneyPlayBox.OpenSDK.FunscriptState.empty | No timeline loaded. |
| HoneyPlayBox.OpenSDK.FunscriptState.ready | Loaded, not started. |
| HoneyPlayBox.OpenSDK.FunscriptState.playing | Timeline running. |
| HoneyPlayBox.OpenSDK.FunscriptState.paused | Position retained. |
| HoneyPlayBox.OpenSDK.FunscriptState.stopped | Stopped and reset to zero. |
| HoneyPlayBox.OpenSDK.FunscriptState.ended | Reached script end. |
| HoneyPlayBox.OpenSDK.FunscriptState.disconnected | Playback interrupted by disconnection. |
| HoneyPlayBox.OpenSDK.FunscriptState.error | Playback failed. |

| DeviceNotificationType member | Meaning |
| --- | --- |
| HoneyPlayBox.OpenSDK.DeviceNotificationType.airPressureParameters | Air-pressure parameter reading. |
| HoneyPlayBox.OpenSDK.DeviceNotificationType.pressure | Pressure reading. |
| HoneyPlayBox.OpenSDK.DeviceNotificationType.depth | Depth reading. |
| HoneyPlayBox.OpenSDK.DeviceNotificationType.temperature | Temperature reading. |
| HoneyPlayBox.OpenSDK.DeviceNotificationType.steps | Step or movement count. |
| HoneyPlayBox.OpenSDK.DeviceNotificationType.acceleration | Acceleration reading. |
| HoneyPlayBox.OpenSDK.DeviceNotificationType.unknown | Unclassified reading. |

DeviceResponseStatus remains exported for compatibility. It is not a field in
public feedback and is not a substitute for queue or playback completion.
Use rejected operations, events and documented state fields for application flow.

## Compatibility Entry Points

discoverDevices, connectDevice, disconnectDevice and readBatteryLevel remain
connector aliases for the lifecycle operations. Connector getCommandQueue,
clearCommandQueue and removeCommand address the connector FIFO.

Connector.sendCommand routes to the connector FIFO when the target is in queue
mode; Toy.sendCommand routes to the local queue. Prefer explicit executor calls
to avoid depending on mode. Legacy script methods retain their older semantics;
do not mix them concurrently with executor controls.

For payloads and subscriptions, see [Events](./events.md).
