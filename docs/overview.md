# WASM SDK Overview

HoneyPlayBox WASM SDK provides the same public browser SDK API as the standard
JS SDK while moving low-level SDK logic into WebAssembly.

## Import

```html`n<script src="//sdk.honeyplaybox.com/prod/native-sdk/jssdk/honeyplaybox-connector-jssdk.min.js"></script>`n```

The SDK is exposed under the `HoneyPlayBox.SDK` namespace.

## Scope

The WASM SDK keeps the public API aligned with the JS SDK:

- Discover toys.
- Connect toys.
- Send commands.
- Stop commands.
- Read battery level.
- Receive structured feedback.
- Manage reconnect and disconnect states.

Browser BLE authorization, device selection, connection, and characteristic I/O
still require a JavaScript browser bridge because WebAssembly cannot directly
call browser Bluetooth objects or trigger permission prompts.

## Core Objects

| Object | Description |
| --- | --- |
| `ToyConnector` | Main SDK entry. It manages discovery, connection, events, and connected toys. |
| `Toy` | A connected toy instance. It sends commands, stops commands, reads battery level, and disconnects. |
| `ToyFunctions` | Enum for toy function values used in command input. |
| `DeviceNotificationType` | Enum for structured feedback types. |

## Main Flow

1. Serve the page from `localhost` or `https`.
2. Import the WASM SDK.
3. Create `ToyConnector`.
4. Check browser BLE support with `HoneyPlayBox.SDK.isBleSupported()`.
5. Call `connector.discoverDevices()` from a user click.
6. Render the returned toy list.
7. Connect the selected toy with `connector.connectDevice(toyId)`.
8. Send commands with `toy.sendCommand(commands)`.
9. Listen for `feedback`, `connect`, and `disconnect` events.
10. Disconnect manually with `toy.disconnect()` or `connector.disconnectDevice(toyId)`.

## Command Behavior

When `duration` is greater than `0`, the SDK automatically sends stop when the
longest command duration ends.

When `duration` is `0`, the toy keeps running until a stop operation is sent:

```js
await toy.sendCommand({
  vibration: 60,
  motor: 1,
  duration: 0,
  function: HoneyPlayBox.SDK.ToyFunctions.vibration
});

await toy.stopCommand();
```

## Web Page Requirements

The SDK must run in a browser secure context. Use one of these origins:

- `http://localhost`
- `https://`

Opening an HTML file directly from disk does not provide the browser permission
environment required for BLE discovery.

## Feedback

Feedback events expose consumer-facing fields:

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

Pure command acknowledgement data is handled internally and is not emitted as
toy feedback.
