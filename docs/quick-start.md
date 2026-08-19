# WASM SDK Quick Start

Use this guide to add HoneyPlayBox WASM SDK to a browser page.

## Requirements

- Use Chrome or another compatible browser with Web Bluetooth support.
- Serve the page from `localhost` or `https`.
- Do not open the HTML file directly from disk.
- Call discovery from a user action, such as a button click.

## Minimal Example

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

  document.querySelector("#discover").addEventListener("click", async () => {
    const toys = await connector.discoverDevices();
    selectedToyId = toys[0]?.toyId || "";
  });

  document.querySelector("#connect").addEventListener("click", async () => {
    toy = await connector.connectDevice(selectedToyId);
  });

  document.querySelector("#send").addEventListener("click", async () => {
    await toy.sendCommand([
      {
        value: 60,
        duration: 1000,
        function: HoneyPlayBox.SDK.ToyFunctions.Vibrate
      }
    ]);
  });

  document.querySelector("#stop").addEventListener("click", async () => {
    await toy.stopCommand();
  });
</script>
```

## Notes

- `discoverDevices()` opens the browser permission prompt.
- `Vibrate` does not automatically send stop after the command duration.
- `Constrict` automatically sends stop when `duration > 0`.
- Call `stopCommand()` when the application needs to stop the current action.
- `ToyCommandMode.normal` sends immediately. `ToyCommandMode.queue` sends queued command payloads in order.
- Switching command mode clears waiting queued commands and does not send stop.
- One connector can manage multiple connected toys.
- Battery feedback is emitted as `kind: "battery"` when available.
- Browser BLE permission and GATT I/O are performed through a JavaScript bridge.

