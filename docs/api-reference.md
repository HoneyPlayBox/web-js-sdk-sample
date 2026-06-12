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
| `HoneyPlayBox.SDK.DeviceNotificationType` | Feedback type enum. |
| `HoneyPlayBox.SDK.DeviceResponseStatus` | Internal response status enum. |
| `HoneyPlayBox.SDK.createToyConnector(options)` | Factory for `ToyConnector`. |
| `HoneyPlayBox.SDK.isBleSupported()` | Browser capability check. |

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
| `reconnectMaxDelayMs` | `number` | `10000` | Maximum reconnect delay. |
| `debugTransportBytes` | `boolean` | `false` | Adds transport bytes to command result for local debugging. |

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
| `connector.sendToyCommand(options)` | Sends commands that include `toyId`. |
| `connector.readBatteryLevel(toyId)` | Reads battery level when available. |
| `connector.disconnectDevice(toyId)` | Disconnects manually. |
| `connector.onFeedback(callback)` | Subscribes to toy feedback. |

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

### `toy.sendCommand(commands)`

```js
await toy.sendCommand([
  {
    vibration: 80,
    motor: 1,
    duration: 1000,
    function: HoneyPlayBox.SDK.ToyFunctions.vibration
  }
]);
```

Command fields:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `vibration` | `number` | No | Vibration value. |
| `motor` | `number` | No | Motor index. |
| `duration` | `number` | No | Duration in milliseconds. `0` means keep running until stop is sent. |
| `durationMs` | `number` | No | Alias of `duration`. |
| `function` | `ToyFunctions` | No | Defaults to `HoneyPlayBox.SDK.ToyFunctions.vibration`. |

The SDK automatically sends stop when the longest command duration is greater
than `0` and the duration ends. If `duration` is `0`, the toy keeps running
until `toy.stopCommand()` or `connector.stopCommand(toyId)` is called.

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

## Browser Constraints

- Discovery must be triggered by user interaction.
- The page must be served from `localhost` or `https`.
- Direct file access is not supported for BLE discovery.
- Browser authorization prompts cannot be skipped by SDK code.
- WebAssembly cannot directly operate browser Bluetooth objects; the SDK uses a
  JavaScript bridge for browser-required BLE operations.
