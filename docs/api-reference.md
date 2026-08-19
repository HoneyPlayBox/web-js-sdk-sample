# WASM SDK API Reference

This page describes the public API exposed by the HoneyPlayBox WASM SDK.

## Import

```html
<script src="//sdk.honeyplaybox.com/prod/native-sdk/jssdk/honeyplaybox-connector-jssdk.min.js"></script>
```

## Exports

| Export | Description |
| --- | --- |
| `HoneyPlayBox.SDK.ToyConnector` | Main SDK class. |
| `HoneyPlayBox.SDK.Toy` | Connected toy class. |
| `HoneyPlayBox.SDK.ToyFunctions` | Toy command function enum. |
| `HoneyPlayBox.SDK.ToyCommandMode` | Command send mode enum. |
| `HoneyPlayBox.SDK.Spots` | Stimulation spot enum used by command `target`. |
| `HoneyPlayBox.SDK.DeviceNotificationType` | Feedback type enum. |
| `HoneyPlayBox.SDK.DeviceResponseStatus` | Internal response status enum. |
| `HoneyPlayBox.SDK.createToyConnector(options)` | Factory for `ToyConnector`. |
| `HoneyPlayBox.SDK.isBleSupported()` | Browser capability check. |

## ToyFunctions

Use the enum values below when filling the command `function` field or reading
a toy `features` list.

| Enum | Meaning |
| --- | --- |
| `HoneyPlayBox.SDK.ToyFunctions.Vibrate` | Vibration. |
| `HoneyPlayBox.SDK.ToyFunctions.Rotate` | Rotation. |
| `HoneyPlayBox.SDK.ToyFunctions.Oscillate` | Reciprocating or swinging movement. |
| `HoneyPlayBox.SDK.ToyFunctions.Constrict` | Constriction, squeezing, or pump pressure. |
| `HoneyPlayBox.SDK.ToyFunctions.Spray` | Spray output. |
| `HoneyPlayBox.SDK.ToyFunctions.Temperature` | Heating or cooling level. |
| `HoneyPlayBox.SDK.ToyFunctions.Led` | LED brightness. |
| `HoneyPlayBox.SDK.ToyFunctions.Position` | Fast movement to a target position. |
| `HoneyPlayBox.SDK.ToyFunctions.HwPositionWithDuration` | Hardware movement to a target position over a duration. |

## ToyCommandMode

| Enum | Meaning |
| --- | --- |
| `HoneyPlayBox.SDK.ToyCommandMode.normal` | Send each command immediately. |
| `HoneyPlayBox.SDK.ToyCommandMode.queue` | Put commands into a per-toy queue and send them in order. |

## Spots

Use enum values for command `target` when the application wants to select a
specific stimulation spot.

| Enum | Meaning |
| --- | --- |
| `HoneyPlayBox.SDK.Spots.C` | C spot. |
| `HoneyPlayBox.SDK.Spots.G` | G spot. |
| `HoneyPlayBox.SDK.Spots.A` | A spot. |
| `HoneyPlayBox.SDK.Spots.U` | U spot. |
| `HoneyPlayBox.SDK.Spots.O` | O spot. |
| `HoneyPlayBox.SDK.Spots.P` | P spot. |

## ToyConnector

```js
const connector = new HoneyPlayBox.SDK.ToyConnector({
  autoReconnect: true,
  reconnectMaxAttempts: 5
});
```

### Options

| Name | Type | Default | Description |
| --- | --- | --- | --- |
| `autoReconnect` | `boolean` | `true` | Reconnect after unexpected disconnects. |
| `reconnectMaxAttempts` | `number` | `5` | Maximum reconnect attempts. Set to `0` to disable reconnect. |
| `reconnectDelayMs` | `number` | `1000` | First reconnect delay. |
| `reconnectFailurePauseMs` | `number` | `2000` | Pause after each failed reconnect attempt before retrying. |
| `reconnectMaxDelayMs` | `number` | `10000` | Maximum reconnect delay. |
| `discoveryAcceptAllDevices` | `boolean` | `false` | Filters the Chrome chooser by exact configured BLE names. Set to `true` only for troubleshooting broad authorization. |
| `commandMode` | `ToyCommandMode` | `ToyCommandMode.normal` | Initial command mode for connected toys. |
| `protocolWasmUrl` | `string` | Online SDK WASM path | Optional WebAssembly file URL. Use it for local testing, such as `./protocol.wasm`. |

### Methods

| Method | Description |
| --- | --- |
| `HoneyPlayBox.SDK.isBleSupported()` | Checks browser BLE support. |
| `connector.discoverDevices()` | Requests authorization and returns toy summaries. |
| `connector.connectDevice(toyId)` | Connects a discovered toy. |
| `connector.getConnectedToys()` | Returns all connected toys. |
| `connector.getToy(toyId)` | Returns one connected toy or `null`. |
| `connector.sendCommand(toyId, commands)` | Sends one or more commands. |
| `connector.stopCommand(toyId)` | Stops the target toy. |
| `connector.getCommandQueue(toyId)` | Returns waiting commands for one toy. |
| `connector.clearCommandQueue(toyId)` | Clears waiting commands for one toy. |
| `connector.removeCommand(toyId, commandId)` | Removes one waiting command from one toy queue. |
| `connector.sendToyCommand(options)` | Sends commands that include `toyId`. |
| `connector.readBatteryLevel(toyId)` | Reads battery level when available. |
| `connector.disconnectDevice(toyId)` | Disconnects manually. |
| `connector.onFeedback(callback)` | Subscribes to toy feedback. |
| `connector.onQueueChange(callback)` | Subscribes to per-toy command queue changes. |

## Toy

### Properties

| Name | Type | Description |
| --- | --- | --- |
| `id` | `string` | Browser-side toy id. |
| `toyId` | `string` | Public toy id. |
| `name` | `string` | Toy display name. |
| `avatar` | `string` | Toy avatar URL. |
| `features` | `ToyFunctions[]` | Supported toy functions. |
| `motorCount` | `number` | Motor count. |
| `connected` | `boolean` | Connection state. |
| `commandMode` | `ToyCommandMode` | Current command mode. |
| `queuedCommandCount` | `number` | Number of waiting queued commands. |

### `toy.setCommandMode(mode)`

```js
toy.setCommandMode(HoneyPlayBox.SDK.ToyCommandMode.queue);
```

Switches between normal and queue mode. Switching mode clears the waiting
queue only; it does not send a stop command.

### `toy.clearCommandQueue()`

```js
const removedCount = toy.clearCommandQueue();
```

Clears commands that are waiting in queue mode and returns the number of removed
commands. It does not send a stop command.

### `toy.getCommandQueue()`

```js
const queue = toy.getCommandQueue();
```

Returns queued commands for this toy only. The command currently being sent
stays in the queue with `status: "running"` and is removed after its `duration`
has completed.

```js
[
  {
    commandId: "command-2",
    toyId: "toy-id",
    name: "Kai Pro",
    commands: [
      {
        value: 50,
        duration: 1000,
        function: HoneyPlayBox.SDK.ToyFunctions.Vibrate
      }
    ],
    commandCount: 1,
    queuedAt: 1780000000000,
    position: 1,
    status: "waiting"
  }
]
```

### `toy.removeCommand(commandId)`

```js
const removed = toy.removeCommand("command-2");
```

Removes one waiting command from this toy queue. Returns `true` when a waiting
command was removed, or `false` when the command is not in the waiting queue.
Removing a waiting command does not send stop.

### `toy.onQueueChange(callback)`

```js
const unsubscribe = toy.onQueueChange((queueState) => {
  console.log(queueState.action, queueState.queuedCommandCount);
});
```

Subscribes to queue changes for one toy. The callback runs when a command is
queued, starts sending, completes, fails, is removed, or when the waiting queue
is cleared.

### `toy.sendCommand(commands)`

```js
await toy.sendCommand([
  {
    value: 80,
    target: HoneyPlayBox.SDK.Spots.C,
    duration: 1000,
    function: HoneyPlayBox.SDK.ToyFunctions.Vibrate
  }
]);
```

Command fields:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `value` | `number` | No | Command value. For example vibration strength, constriction strength, or the selected function value. |
| `target` | `Spots` | No | Stimulation spot enum. Omit it to let the SDK choose from `function`. |
| `duration` | `number` | No | Duration in milliseconds. `0` means keep running until stop is sent. |
| `durationMs` | `number` | No | Alias of `duration`. |
| `function` | `ToyFunctions` | No | Defaults to `HoneyPlayBox.SDK.ToyFunctions.Vibrate`. |
| `centerPosition` | `number` | For `Position` | Center position used by position-capable toys. |
| `amplitude` | `number` | For `Position` | Amplitude strength used by position-capable toys. |
| `speed` | `number` | For `Position` | Movement speed used by position-capable toys. |

When the command does not specify `target`, the SDK selects the target
internally from the toy function. For example, Kai Pro maps `Vibrate` to its
vibration actuator and `Constrict` to its constriction actuator. Toys where the
same function uses multiple stimulation points can also omit `target`; the SDK
expands the command internally.

Legacy fields such as `vibration`, `strength`, `vibrationStrength`, and `motor`
are still accepted for compatibility, but new integrations should use `value`,
`function`, and optional `target`.

For `HoneyPlayBox.SDK.ToyFunctions.Position`, send `centerPosition`,
`amplitude`, and `speed` instead of `value`:

```js
await toy.sendCommand({
  function: HoneyPlayBox.SDK.ToyFunctions.Position,
  centerPosition: 50,
  amplitude: 30,
  speed: 5,
  duration: 1000
});
```

`Vibrate` commands do not automatically send stop after `duration`. Call
`toy.stopCommand()` or `connector.stopCommand(toyId)` when the application needs
to stop vibration. `Constrict` commands with `duration > 0` automatically send
stop when the duration ends. `duration: 0` keeps the action running until stop
is sent.

In queue mode, each `sendCommand()` call enters that toy's queue as one
independent execution unit. If `sendCommand()` receives an array, that array is
sent as one execution unit, not split into multiple queue items. In queue mode,
`sendCommand()` resolves after the unit is queued and returns `status:
"queued"` plus the `commandId`; the queued unit is sent by the SDK queue worker.
The SDK sends the current queued unit, keeps it in the queue with `status:
"running"`, waits for the longest `duration` in that unit, removes that unit
from the queue, then sends the next queued unit. Commands with `duration: 0` do
not wait. Each connected toy has an independent queue, so one toy's queued
commands do not block another toy. Switching command mode clears waiting queued
units for the selected toy without sending stop.

### `toy.stopCommand()`

```js
await toy.stopCommand();
```

### `toy.readBatteryLevel()`

```js
const batteryLevel = await toy.readBatteryLevel();
```

### `toy.disconnect()`

```js
await toy.disconnect();
```

## Events

| Event | Detail | Description |
| --- | --- | --- |
| `discover` | Toy summary | Discovery completed. |
| `connect` | Connect state | Toy connection or reconnect state changed. |
| `feedback` | Feedback detail | Toy feedback received. |
| `queuechange` | Queue state | A toy command queue changed. |
| `disconnect` | Toy state | Toy disconnected. |
| `command` | Command result | A command or stop command was sent. |
| `error` | Error detail | Auto-stop or async SDK operation failed. |

Feedback detail:

```js
{
  toyId: "toy-id",
  name: "Vibrosa Mini",
  kind: "pressure",
  value: 15.5,
  unit: "value",
  time: Date.now()
}
```

Queue change detail:

```js
{
  toyId: "toy-id",
  name: "Kai Pro",
  action: "enqueue",
  commandId: "command-2",
  commandMode: HoneyPlayBox.SDK.ToyCommandMode.queue,
  queuedCommandCount: 1,
  queue: [
    {
      commandId: "command-2",
      toyId: "toy-id",
      name: "Kai Pro",
      commands: [
        {
          value: 50,
          duration: 1000,
          function: HoneyPlayBox.SDK.ToyFunctions.Vibrate
        }
      ],
      commandCount: 1,
      queuedAt: 1780000000000,
      position: 1,
      status: "waiting"
    }
  ],
  time: Date.now()
}
```

`action` can be `enqueue`, `start`, `complete`, `failed`, `remove`, `clear`,
or `modeChange`.

## Browser Constraints

- Discovery must be triggered by user interaction.
- The page must be served from `localhost` or `https`.
- Direct file access is not supported for BLE discovery.
- Browser authorization prompts cannot be skipped by SDK code.
- WebAssembly cannot directly operate browser Bluetooth objects; the SDK uses a
  JavaScript bridge for browser-required BLE operations.

