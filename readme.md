# HoneyPlayBox OpenSDK Sample

This sample demonstrates the public SDK: device discovery, connection, commands,
a connector queue, script controls, battery and structured feedback.

## Open The Sample

Serve the sample from HTTPS or localhost. The default page loads:

```html
<script src="//sdk.honeyplaybox.com/prod/native-sdk/jssdk/honeyplaybox-opensdk-jssdk.min.js"></script>
```

For the local sample server, use
[the sample](http://localhost:5184/sdk-demo.html).
For workspace integration checks, use
[local SDK mode](http://localhost:5184/sdk-demo.html?sdk=local).
The local option selects workspace resources and the repository product catalog
through the sample server. It does not publish anything online or change the
production catalog. Production integrations use SDK-managed online metadata.

## Device Selection

Choose BLE for direct Bluetooth or HID for a supported USB gateway.
For BLE, click Discover to request browser authorization. For HID, click Connect
HID and select the adapter first. Once connected, click Discover to search for
toys. Select a returned toy and click Connect Selected. Discover is disabled
in HID mode until the adapter is open; unplugging restores Connect HID.

The page uses ToyConnector for BLE and HIDToyConnector for HID. Lifecycle calls
belong to connector: scan, connect, disconnect, getToy, getConnectedToys and
readBattery. Switching transport disconnects the previous transport's toys.

Disconnect HID cancels scheduling, attempts to stop all connected HID toys,
disconnects them, and closes the adapter. Refresh and page close attempt the same
cleanup, but browsers do not await it. Use Disconnect HID before leaving when
completion matters; device-side safety behavior is still required for crashes.

## Execute And Observe

- Immediate sends to the selected toy.
- Queue appends to the connector's shared FIFO. Its view shows all units and
  their target toys, not a separate queue for the selected toy.
- Funscript controls in the sample operate on the selected toy. For matched
  multi-toy playback in an application, use the no-ID calls documented below.
- Battery, pressure, connection and playback readings update from events.
- Stop is different from clearing a queue: clearing sends no stop.

The sample does not replace physical-device verification. Inspect supported
functions before sending. A queued result means accepted into the FIFO, not
that the toy has executed it.

## Integration Documentation

- [Overview](./docs/overview.md)
- [Quick Start](./docs/quick-start.md)
- [Device Lifecycle](./docs/device-flow.md)
- [HID And Page Lifecycle](./docs/hid-lifecycle.md)
- [Execution Modes](./docs/executors.md)
- [Queues](./docs/queues.md)
- [Funscript](./docs/funscript.md)
- [Events](./docs/events.md)
- [API Reference](./docs/api-reference.md)
- [Integration Checklist](./docs/integration-guide.md)

Use the online SDK URL in your application. Product metadata is managed internally.
