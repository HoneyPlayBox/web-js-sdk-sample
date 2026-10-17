# Device Lifecycle

## Connector Selection

```javascript
const connector = new HoneyPlayBox.OpenSDK.ToyConnector();
// Alternative for a supported USB HID gateway:
// const connector = new HoneyPlayBox.OpenSDK.HIDToyConnector();
```

Use separate instances if both transports are required concurrently.
HIDToyConnector is fixed to HID and rejects attempts to switch it to BLE.

## Capability Checks

```javascript
const ble = await HoneyPlayBox.OpenSDK.isBleSupported();
const hid = await HoneyPlayBox.OpenSDK.isHidSupported();
```

Check support before enabling the corresponding controls. Support does not
mean the user has granted access or that a toy is connected. Checks do not
open permission prompts. Both transports require HTTPS or localhost.

## Discover And Connect

```javascript
discoverButton.onclick = async () => {
  try {
    const toys = await connector.scan();
    renderToyList(toys);
  } catch (error) {
    showMessage(error.message);
  }
};
// In a separate connection handler, after the user selects a discovered toy:
const toy = await connector.connect(toyId);
const toys = connector.getConnectedToys();
const selectedToy = connector.getToy(toyId);
```

UI functions and button variables in snippets belong to the application.
Call scan directly from a click; do not await unrelated work first.
BLE authorization selects a Bluetooth device. For HID, first connect a gateway
with connectHid from its own click handler, then call scan to discover toys for
up to ten seconds. The HID chooser is not a toy list. Only matching supported
products are returned. See [HID And Page Lifecycle](./hid-lifecycle.md).

Connecting an ID array is supported. The returned Toy array follows input order.
If one connection fails, already successful connections are not rolled back.

The connector registry can retain a toy while it is reconnecting. Use
`toy.connected` and connection events, not registry membership alone, to enable
controls. Treat toyId as an opaque identifier, not a name or hardware address.

## Battery And Disconnection

```javascript
const battery = await connector.readBattery(toyId);
await connector.disconnect(toyId);
```

Battery values may be unavailable; do not display an unknown value as zero.
Connection requests a battery reading when supported. Subsequent updates arrive
through feedback events.

Manual disconnect does not trigger reconnection. Unexpected BLE disconnects
may retry according to options. Setting reconnectMaxAttempts to zero disables
retries; failed retries pause for reconnectFailurePauseMs, default 2000.
HID disconnects require manual reconnection. Disconnection cancels affected
queue scheduling and script playback; scripts do not automatically resume.
Multi-toy queue units containing a disconnected toy are cancelled whole.

## Flow

1. Create the connector and check browser support.
2. For HID, connect the adapter with connectHid from a user click.
3. Discover with connector.scan and select a returned toyId.
4. Connect with connector.connect(toyId).
5. Execute through Immediate, Queue or Funscript and observe events.
6. Stop required output before disconnecting each toy.
7. In the sample, Disconnect HID also closes the adapter.

Discovery, connection, queries and battery methods exist on connector, not on
Immediate, Queue or Funscript. See [API Reference](./api-reference.md).
