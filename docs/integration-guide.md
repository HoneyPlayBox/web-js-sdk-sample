# HoneyPlayBox WASM SDK Integration Guide

This guide describes how to integrate the HoneyPlayBox browser SDK in a web
application. It focuses on public SDK behavior only. Integrators only need to
use the public JavaScript APIs and do not need to call the WebAssembly module
directly.

## 1. Browser Requirements

- Use Chrome or another browser with Web Bluetooth support.
- Serve the page from `https` or `localhost`.
- Do not open the HTML file directly from disk.
- Trigger device discovery from a user action, such as a button click.
- Keep the page active while connecting and sending commands.

Check browser support before showing BLE controls:

```js
const bleState = await HoneyPlayBox.SDK.isBleSupported();
if (!bleState.supported) {
  // Show an application-level unsupported-browser message.
}
```

## 2. Load The SDK

Use the online SDK in production:

```html
<script src="//sdk.honeyplaybox.com/prod/native-sdk/jssdk/honeyplaybox-connector-jssdk.min.js"></script>
```

Create one connector for the page:

```js
const connector = new HoneyPlayBox.SDK.ToyConnector({
  autoReconnect: true,
  reconnectMaxAttempts: 5
});
```

## 3. Discover Devices

Discovery opens the browser permission prompt and must run inside a user
gesture.

```js
document.querySelector("#discover").addEventListener("click", async () => {
  const toys = await connector.discoverDevices();
  renderToyList(toys);
});
```

The result contains configured toy summaries:

```js
{
  toyId: "browser-device-id",
  name: "Toy Name",
  avatar: "https://example.com/toy.png",
  features: [HoneyPlayBox.SDK.ToyFunctions.Vibrate],
  transport: "ble-wasm"
}
```

If no toys are returned, the user may have cancelled the browser prompt, the
browser may not have BLE permission, or the nearby device may not match the SDK
product configuration.

## 4. Connect A Toy

Connect by `toyId` after discovery:

```js
const toy = await connector.connectDevice(toyId);
```

A connected toy exposes display data and capabilities:

```js
console.log(toy.toyId);
console.log(toy.name);
console.log(toy.avatar);
console.log(toy.features);
console.log(toy.connected);
```

You can manage multiple toys with one connector:

```js
const toys = connector.getConnectedToys();
const toy = connector.getToy(toyId);
```

## 5. Send Commands

Use `sendCommand()` on a `Toy`, or `connector.sendCommand(toyId, commands)` from
the connector.

```js
await toy.sendCommand({
  value: 60,
  duration: 1000,
  function: HoneyPlayBox.SDK.ToyFunctions.Vibrate
});
```

You can pass an array when a single execution unit needs multiple command
entries:

```js
await toy.sendCommand([
  {
    value: 60,
    duration: 1000,
    function: HoneyPlayBox.SDK.ToyFunctions.Vibrate
  },
  {
    value: 40,
    duration: 1000,
    function: HoneyPlayBox.SDK.ToyFunctions.Constrict
  }
]);
```

One `sendCommand()` call is one execution unit. Even when the argument is an
array, the whole array is treated as one execution unit.

### Command Fields

| Field | Type | Description |
| --- | --- | --- |
| `value` | `number` | Function value, such as vibration strength or constriction strength. |
| `duration` | `number` | Duration in milliseconds. `0` means keep running until stop is sent. |
| `durationMs` | `number` | Alias of `duration`. |
| `function` | `ToyFunctions` | Toy function. Defaults to `ToyFunctions.Vibrate`. |
| `target` | `Spots` | Optional stimulation point. Omit it to let the SDK choose from the function. |
| `centerPosition` | `number` | Position command center value. |
| `amplitude` | `number` | Position command amplitude value. |
| `speed` | `number` | Position command speed value. |

Use enum values instead of raw strings:

```js
HoneyPlayBox.SDK.ToyFunctions.Vibrate;
HoneyPlayBox.SDK.ToyFunctions.Constrict;
HoneyPlayBox.SDK.ToyFunctions.Position;
HoneyPlayBox.SDK.Spots.C;
HoneyPlayBox.SDK.Spots.G;
```

## 6. Stop Commands

Use `stopCommand()` when the application needs to stop the current action:

```js
await toy.stopCommand();
```

Important behavior:

- `duration: 0` keeps the command running until stop is sent.
- `Vibrate` does not automatically send stop after `duration`.
- `Constrict` with `duration > 0` automatically sends stop when the duration
  ends.

## 7. Queue Mode

Normal mode sends immediately:

```js
toy.setCommandMode(HoneyPlayBox.SDK.ToyCommandMode.normal);
```

Queue mode puts each `sendCommand()` call into that toy's independent queue:

```js
toy.setCommandMode(HoneyPlayBox.SDK.ToyCommandMode.queue);

const result = await toy.sendCommand({
  value: 50,
  duration: 1000,
  function: HoneyPlayBox.SDK.ToyFunctions.Vibrate
});

console.log(result.status); // "queued"
console.log(result.commandId);
```

Queue rules:

- Each toy has its own queue.
- Each `sendCommand()` call is one queue item.
- An array argument is still one queue item.
- The current item stays in the queue with `status: "running"`.
- After the current item duration completes, only that item is removed.
- Waiting queue items are not cleared when the current item completes.
- Switching command mode clears waiting queue items and does not send stop.

Queue APIs:

```js
const queue = toy.getCommandQueue();
const removed = toy.removeCommand(commandId);
const removedCount = toy.clearCommandQueue();
```

Subscribe to queue changes:

```js
const unsubscribe = connector.onQueueChange((queueState) => {
  console.log(queueState.action);
  console.log(queueState.queuedCommandCount);
});
```

Queue event actions:

| Action | Meaning |
| --- | --- |
| `enqueue` | A command unit entered the queue. |
| `start` | A queued unit started running. |
| `complete` | A queued unit completed and left the queue. |
| `failed` | A queued unit failed and left the queue. |
| `remove` | A waiting queued unit was removed. |
| `clear` | Waiting queued units were cleared. |
| `modeChange` | Command mode changed. |

## 8. Feedback Events

Subscribe to structured toy feedback:

```js
connector.onFeedback((feedback) => {
  switch (feedback.kind) {
    case "battery":
      updateBattery(feedback.toyId, feedback.value);
      break;
    case "pressure":
      updatePressure(feedback.toyId, feedback.value);
      break;
    default:
      handleOtherFeedback(feedback);
      break;
  }
});
```

Feedback shape:

```js
{
  toyId: "toy-id",
  name: "Toy Name",
  kind: "battery",
  value: 80,
  unit: "percent",
  time: Date.now()
}
```

## 9. Battery

The SDK reads battery level automatically after connection when the device
supports it. You can also request it manually:

```js
const batteryLevel = await toy.readBatteryLevel();
```

Battery feedback is emitted as:

```js
{
  kind: "battery",
  value: 80,
  unit: "percent"
}
```

## 10. Disconnect And Reconnect

Manual disconnect:

```js
await toy.disconnect();
```

Unexpected device-side disconnects are reported through events. When
`autoReconnect` is enabled, the SDK will attempt to reconnect.

```js
connector.addEventListener("disconnect", (event) => {
  updateToyStatus(event.detail.toyId, "Disconnected");
});

connector.addEventListener("connect", (event) => {
  updateToyStatus(event.detail.toyId, event.detail.status);
});
```

Common connect statuses:

| Status | Meaning |
| --- | --- |
| `connected` | Initial connection completed. |
| `reconnecting` | Reconnect is scheduled. |
| `reconnected` | Reconnect completed. |
| `reconnectError` | One reconnect attempt failed. |
| `reconnectStopped` | Reconnect stopped. |

## 11. Recommended UI Flow

1. Check BLE support.
2. Ask the user to click Discover.
3. Show discovered configured toys.
4. Connect the selected toy.
5. Show connection, battery, queue, and feedback state.
6. Send commands with `sendCommand()`.
7. Use queue mode only when commands should run sequentially.
8. Stop the current action when the application requires it.
9. Reflect disconnect and reconnect events in the UI.

## 12. Error Handling

Wrap user operations in `try/catch` and show application-level messages:

```js
try {
  const toys = await connector.discoverDevices();
} catch (error) {
  showMessage(error.message);
}
```

Common causes:

| Situation | Common Cause |
| --- | --- |
| Discovery does not open | The call was not triggered by a user gesture. |
| No devices returned | Browser prompt cancelled, no configured device nearby, or device is off. |
| Connect failed | Device powered off, out of range, or already busy. |
| Command failed | Device disconnected or browser GATT operation failed. |
| BLE unsupported | Browser or current page origin does not support Web Bluetooth. |

## 13. Minimal Complete Example

```html
<button id="discover">Discover</button>
<button id="connect">Connect</button>
<button id="send">Send</button>
<button id="stop">Stop</button>

<script src="//sdk.honeyplaybox.com/prod/native-sdk/jssdk/honeyplaybox-connector-jssdk.min.js"></script>
<script>
  const connector = new HoneyPlayBox.SDK.ToyConnector();
  let selectedToyId = "";
  let toy = null;

  connector.onFeedback((feedback) => {
    console.log("feedback", feedback);
  });

  connector.onQueueChange((queueState) => {
    console.log("queue", queueState);
  });

  document.querySelector("#discover").addEventListener("click", async () => {
    const toys = await connector.discoverDevices();
    selectedToyId = toys[0]?.toyId || "";
  });

  document.querySelector("#connect").addEventListener("click", async () => {
    toy = await connector.connectDevice(selectedToyId);
  });

  document.querySelector("#send").addEventListener("click", async () => {
    await toy.sendCommand({
      value: 60,
      duration: 1000,
      function: HoneyPlayBox.SDK.ToyFunctions.Vibrate
    });
  });

  document.querySelector("#stop").addEventListener("click", async () => {
    await toy.stopCommand();
  });
</script>
```
