# HoneyPlayBox WASM SDK Sample

This folder contains the browser sample for the HoneyPlayBox WASM SDK. The
sample validates the public SDK integration flow:

- Check whether the current browser supports BLE.
- Discover configured toy devices.
- Connect the selected toy.
- Send commands.
- Stop commands.
- Read and display battery level.
- Receive and display structured toy feedback.

The sample page is not a protocol test tool. Integrators do not need to call
the WebAssembly module directly.

## Documentation

Read the full WASM SDK documentation in the sibling `docs` folder:

- [Overview](../docs/overview.md)
- [Quick Start](../docs/quick-start.md)
- [Device Flow](../docs/device-flow.md)
- [API Reference](../docs/api-reference.md)

## Run The Sample

Start the local sample server:

```powershell
node server.cjs
```

Open:

```text
http://localhost:5184/sdk-demo.html
```

The page must be served from `localhost` or `https`. Do not open the HTML file
directly from disk.

## Integration Notes

Load the online SDK:

```html
<script src="//sdk.honeyplaybox.com/prod/native-sdk/jssdk/honeyplaybox-connector-jssdk.min.js"></script>
```

Create a connector:

```js
const connector = new HoneyPlayBox.SDK.ToyConnector();
```

Device discovery must be triggered by a user action, such as a button click,
because the browser BLE permission prompt requires a user gesture:

```js
const devices = await connector.discoverDevices();
```

Connect a device:

```js
const toy = await connector.connectDevice(devices[0].toyId);
```

Send commands:

```js
await toy.sendCommand([
  {
    vibration: 50,
    motor: 1,
    duration: 1000,
    function: HoneyPlayBox.SDK.ToyFunctions.vibration
  }
]);
```

Stop commands:

```js
await toy.stopCommand();
```

Subscribe to feedback:

```js
connector.onFeedback((feedback) => {
  console.log(feedback);
});
```

## Important Behavior

- `duration` is measured in milliseconds.
- `duration: 0` means the command keeps running until `stopCommand()` is called.
- When `duration > 0`, the SDK sends stop automatically after the duration
  ends.
- One `ToyConnector` can manage multiple connected toys.
- Product configuration is loaded from the fixed SDK product configuration URL.
- The SDK loads its WebAssembly file from the fixed online SDK path.
- The sample displays structured status and feedback only. Integrators do not
  need to handle low-level transport data.
