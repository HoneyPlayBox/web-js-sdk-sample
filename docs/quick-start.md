# Quick Start

Serve this page from HTTPS or localhost. Use a browser supporting Web Bluetooth.
For a supported USB HID gateway, change the constructor to
`new HoneyPlayBox.OpenSDK.HIDToyConnector()`; lifecycle and executor APIs remain
the same. For a two-step HID interface, follow
[HID And Page Lifecycle](./hid-lifecycle.md): Connect HID first, Discover second.

## Minimal Page

```html
<button id="discover">Discover</button>
<select id="toys" aria-label="Toy"></select>
<button id="connect">Connect</button>
<button id="send">Send</button>
<button id="stop">Stop</button>
<button id="disconnect">Disconnect</button>
<pre id="status"></pre>

<script src="//sdk.honeyplaybox.com/prod/native-sdk/jssdk/honeyplaybox-opensdk-jssdk.min.js"></script>
<script>
  const connector = new HoneyPlayBox.OpenSDK.ToyConnector();
  const list = document.querySelector("#toys");
  const status = document.querySelector("#status");
  let activeToyId = null;

  // Invoke immediately; discovery must retain the click's user activation.
  function bind(id, operation) {
    document.querySelector(id).onclick = async () => {
      try {
        await operation();
      } catch (error) {
        status.textContent = error.message;
      }
    };
  }
  function requireToyId() {
    const toy = activeToyId && connector.getToy(activeToyId);
    if (!toy?.connected) throw new Error("Connect a toy first.");
    return toy.toyId;
  }
  connector.onFeedback(feedback => {
    status.textContent = JSON.stringify(feedback, null, 2);
  });
  connector.addEventListener("connect", event => {
    status.textContent = event.detail.status;
  });
  connector.addEventListener("disconnect", () => {
    status.textContent = "Disconnected";
  });

  bind("#discover", async () => {
    const toys = await connector.scan();
    list.replaceChildren(...toys.map(toy => new Option(toy.name, toy.toyId)));
  });
  bind("#connect", async () => {
    if (!list.value) throw new Error("Select a toy first.");
    const toy = await connector.connect(list.value);
    activeToyId = toy.toyId;
    status.textContent = "Connected: " + toy.name;
  });
  bind("#send", () => connector.Immediate.execute(requireToyId(), {
    function: HoneyPlayBox.OpenSDK.ToyFunctions.Vibrate,
    value: 50,
    duration: 1000
  }));
  bind("#stop", () => connector.Immediate.stop(requireToyId()));
  bind("#disconnect", () => connector.disconnect(requireToyId()));
</script>
```

The send example requires a toy whose features include
`HoneyPlayBox.OpenSDK.ToyFunctions.Vibrate`. Render available functions from
the selected toy's features instead of assuming every toy supports vibration.
Battery feedback is requested automatically after connection when supported.

## Choose An Execution Mode

The following are independent alternatives, not a sequence to execute together.
The toy IDs must refer to connected toys.

```javascript
// Immediate: one toy.
await connector.Immediate.execute(toyAId, {
  function: HoneyPlayBox.OpenSDK.ToyFunctions.Vibrate,
  value: 50, duration: 1000
});
```

```javascript
// Queue: one multi-toy unit, then a single-toy unit.
await connector.Queue.execute([toyAId, toyBId], {
  function: HoneyPlayBox.OpenSDK.ToyFunctions.Vibrate,
  value: 40, duration: 1000
});
await connector.Queue.execute(toyAId, {
  function: HoneyPlayBox.OpenSDK.ToyFunctions.Vibrate,
  value: 70, duration: 500
});
```

```javascript
// Funscript: match connected toys without a toy ID.
await connector.Funscript.load({
  tracks: [{
    id: "vibration",
    function: HoneyPlayBox.OpenSDK.ToyFunctions.Vibrate,
    actions: [{ at: 0, pos: 0 }, { at: 1000, pos: 80 }, { at: 2000, pos: 0 }]
  }]
});
await connector.Funscript.start();
```

Queue execute resolves after enqueue. The next unit waits for every target's
send completion plus its own longest duration. Funscript load does not start
playback; start takes execution ownership of matched toys.

Read [Queues](./queues.md), [Funscript](./funscript.md) and
[Events](./events.md) before adding playback controls.
