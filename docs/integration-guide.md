# Integration Checklist

This guide is a checklist, not a second API specification. Detailed behavior
belongs to [Device Lifecycle](./device-flow.md), [Queues](./queues.md),
[Funscript](./funscript.md) and [Events](./events.md).

## Setup

1. Serve the application from HTTPS or localhost.
2. Load honeyplaybox-opensdk-jssdk.min.js from the published SDK URL.
3. Create ToyConnector for BLE or HIDToyConnector for a supported USB gateway.
4. Check the corresponding browser capability before enabling discovery.
5. Register connection, feedback, queue and playback listeners.
6. For HID, call connector.connectHid from a click first. Then call connector.scan
   from Discover and render the returned toys. BLE uses Discover directly.
7. Connect selected IDs through connector.connect and verify toy.connected.

Product names, avatars, functions and targets come from SDK-managed metadata.
Do not hard-code one product's capabilities for every toy.

## Keep Responsibilities Separate

```javascript
const toy = await connector.connect(toyId);
const toys = connector.getConnectedToys();
const selectedToy = connector.getToy(toyId);
```

Only the connector handles discovery, connections and registry queries.
Use Immediate for direct commands, Queue for a shared FIFO, and Funscript for
matched timeline playback. Toy.sendCommand in Toy queue mode is deliberately a
different, local queue.

Do not use the return of Queue.execute as proof that an action has run.
Do not use successful writes as physical-completion feedback. Render state from
events and identify connector queue units by commandId.

## Multi-Toy UI

- Render one card/row per toyId, using name and avatar for display.
- Select functions from the toy's features and use ToyFunctions values.
- Keep unknown battery separate from a zero-percent reading.
- Display connector queues as units; show toyIds and each command's target.
- Display Toy-local queues separately or label their scope explicitly.
- Show per-toy Funscript status and matched/skipped tracks.
- Reflect disconnect immediately, including during reconnect attempts.
- Stop each required toy explicitly; cancelling a group unit does not stop all
  of its already-running targets.

## Timing And Cancellation

For a connector queue unit, next-unit eligibility is the latest target send
completion plus that target's longest duration. Zero-duration targets add no
wait. Local reservations and transport latency affect when targets actually send.

Queue.clear cancels scheduling, not physical output. Filtered clear cancels whole
multi-toy units containing the target. Execution replacement is also scoped by
affected toys; unrelated units remain. Read the cancellation section in
[Queues](./queues.md) before implementing stop-all or transport switching.

Funscript pause and stop request output stop for eligible participants. Use
resume after pause. Media synchronization takes milliseconds of media position,
not wall-clock time.

## Errors

Catch method rejections and subscribe to background events.

| Symptom | Check |
| --- | --- |
| Authorization does not open | User gesture, secure origin and browser API support. |
| HID chooser has no toys | It selects a gateway; toy scan occurs afterward. |
| No supported toys returned | Device power, permissions, range and supported product matching. |
| Connect fails | Range, device power or another active connection. |
| A queue execute returned but nothing moved | It confirms enqueue; inspect running units, reservations and failed events. |
| Funscript load fails | Valid actions/tracks, no overlaps and at least one compatible toy. |
| Funscript start rejects | Loaded state; use resume after pause. |
| Group operation partially fails | Inspect per-target failures and each toy's status. |
| Cleared queue but toy still moves | Clear sends no stop; explicitly stop required toys. |
| Local fix not visible in sample | Default sample uses the published SDK; use its local test URL or publish the update. |
| Product loading fails before the chooser opens | Check the failing response status, network and CORS headers; this is not an empty radio scan. |
| Connect HID is missing from the SDK | Deploy the matching release; local changes do not update the online script. |
| A toy keeps moving after the page closes | Browser termination can interrupt cleanup; require a device-side safety timeout for guarantees. |

Avoid logging internal communication details. Application logs should describe
input commands, structured readings, queue changes and playback state.

## Migration Notes

| Old assumption | Current contract |
| --- | --- |
| HoneyPlayBox.SDK | HoneyPlayBox.OpenSDK. |
| Lifecycle on Immediate | scan/connect/disconnect/getToy/getConnectedToys/readBattery on connector. |
| One connector queue per toy | One connector FIFO; separate Toy-local queues. |
| An array is sequential queue entries | One execute call is one unit, even for an array. |
| Every queue unit targets one toy | Units may group multiple toys and commands. |
| Funscript examples need toyId | Main calls omit toyId and use matched participants. |
| Clear means stop | Clear cancels scheduling only. |
| Longest duration alone defines completion | Wait from each target's successful send completion. |

## Before Shipping

Test BLE and HID separately on the target browsers and operating systems.
Include permission cancellation, disconnect during output, partial multi-toy
failure, queue clear during a write, unsupported tracks and UI subscription cleanup.
Verify both uncompressed local behavior and the actual published minified asset.
SDK test results do not replace testing with the intended physical devices.

Read [HID And Page Lifecycle](./hid-lifecycle.md) before implementing page exit.
Never treat an attempted stop, a closed page or an adapter disconnection as
confirmed physical output completion.
