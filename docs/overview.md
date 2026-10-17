# HoneyPlayBox OpenSDK

HoneyPlayBox OpenSDK connects browser applications to supported toys over BLE
or a supported USB HID gateway. All public classes and enums use
`HoneyPlayBox.OpenSDK`.

## Load The SDK

```html
<script src="//sdk.honeyplaybox.com/prod/native-sdk/jssdk/honeyplaybox-opensdk-jssdk.min.js"></script>
```

Use the published browser script directly. Product information is managed by
the SDK; applications do not supply product configuration.

## Ownership

| Owner | Responsibility |
| --- | --- |
| `connector` | Discovery, connection, device registry, battery reads and events. |
| `connector.Immediate` | Send a unit to one toy now; explicitly stop one toy. |
| `connector.Queue` | One FIFO of execution units shared by all toys in the connector. |
| `connector.Funscript` | Load scripts, match capabilities and control playback. |
| `toy` | Device properties and a separate toy-local command queue. |

Device lifecycle methods do not belong to the executors.

```javascript
const connector = new HoneyPlayBox.OpenSDK.ToyConnector();
// For a USB HID gateway, use this constructor instead:
// const connector = new HoneyPlayBox.OpenSDK.HIDToyConnector();

const toy = await connector.connect(toyId);
const toys = connector.getConnectedToys();
const selectedToy = connector.getToy(toyId);
```

These connection examples assume discovery and user selection have already
provided toyId. Separate connector instances have separate registries and queues.

## Three Execution Choices

- Immediate sends to a specified toy without joining the connector FIFO.
- Queue appends one execution unit per call. One unit may target several toys.
  Targets run concurrently within a unit; units run sequentially.
- Funscript matches tracks to connected toys. Main playback calls omit toyId;
  each matched toy executes only its supported tracks.

Toy-local queues are separate from the connector FIFO. Different toys can run
local queues concurrently. Both owners serialize complete units on the same toy
to avoid overwriting each other's queued output.

## Browser Requirements

Serve from HTTPS or localhost. Do not open the page directly as a local file.
BLE requires Web Bluetooth; HID requires WebHID and a supported gateway.
Discovery must originate directly from a user click. Permissions cannot be
bypassed, and constructing a connector does not grant them.

Browser scheduling and device latency are not real-time guarantees. A successful
write or elapsed queue duration is not physical completion feedback.

## Reading Order

1. [Quick Start](./quick-start.md): minimal browser integration.
2. [Device Lifecycle](./device-flow.md): discovery and connection ownership.
3. [Execution Modes](./executors.md): choosing an executor and replacing output.
4. [Queues](./queues.md): units, multi-toy timing, removal and local queues.
5. [Funscript](./funscript.md): matching, playback controls and limits.
6. [Events](./events.md): status and sensor feedback.
7. [API Reference](./api-reference.md): signatures and enum meanings.
8. [Integration Checklist](./integration-guide.md): production and migration checks.
9. [HID And Page Lifecycle](./hid-lifecycle.md): adapter authorization, discovery and exit limitations.

## Current Contract

This edition reflects the browser SDK and sample as of October 13, 2026.
All examples use HoneyPlayBox.OpenSDK. The sample's adapter shutdown workflow
is application code, not an automatic SDK guarantee. Deploy the matching SDK
release before using newly documented adapter methods with the online script.
