# HID And Page Lifecycle

## Two Separate Connections

Connecting the USB adapter authorizes and opens the gateway. Connecting a toy
selects a discovered device behind that gateway. These are separate operations.
All public calls below belong to HoneyPlayBox.OpenSDK.

| Step | Operation | Result |
| --- | --- | --- |
| Capability | isHidSupported() | API and secure-context availability; no authorization. |
| Adapter | connectHid() | User chooses a gateway; adapter opens. No toy scan. |
| Discovery | scan() | Scans for supported toys through the open gateway. |
| Toy | connect(toyId) | Connects one discovered toy and requests battery when supported. |
| Commands | Immediate, Queue, Funscript | Execute against connected toys. |

## Integration Example

The application supplies the buttons, rendering and error presentation.
Call connectHid directly from a user gesture, without unrelated awaits first.

```javascript
const connector = new HoneyPlayBox.OpenSDK.HIDToyConnector();
discoverButton.disabled = true;

connectHidButton.onclick = async () => {
  connectHidButton.disabled = true;
  try {
    await connector.connectHid();
  } catch (error) {
    showMessage(error.message);
  } finally {
    const ready = connector.isHidConnected();
    connectHidButton.disabled = ready;
    discoverButton.disabled = !ready;
  }
};

discoverButton.onclick = async () => {
  if (!connector.isHidConnected()) return;
  discoverButton.disabled = true;
  try {
    renderToyList(await connector.scan());
  } catch (error) {
    showMessage(error.message);
  } finally {
    discoverButton.disabled = !connector.isHidConnected();
  }
};

// The gateway handles its disconnect event synchronously. Defer the UI check
// until all disconnect listeners have processed the adapter removal.
navigator.hid?.addEventListener("disconnect", () => {
  queueMicrotask(() => {
    const ready = connector.isHidConnected();
    discoverButton.disabled = !ready;
    connectHidButton.disabled = ready;
  });
});
```

After user selection, connect with connector.connect(toyId). Do not pass a
gateway identifier as toyId. isHidConnected reports the open adapter handle;
inspect toy.connected for individual toys. Permission cancellation is retryable.
Reopening an already-open adapter does not prompt again. For compatibility,
scan can authorize a missing adapter, but the sample uses the explicit workflow.

## Sample Shutdown Behavior

The sample's Disconnect HID button performs application-level cleanup:

1. Clear the shared queue and each toy-local queue, and interrupt script playback.
2. Attempt Immediate.stop for every connected HID toy.
3. Attempt to disconnect every toy, even if another toy's stop failed.
4. Close the adapter and restore connection controls.

Concurrent cleanup requests reuse the pending cleanup operation. Switching
away from HID performs this cleanup too. Failed stops are not reported as
successful physical stops. The Disconnect button for a selected toy does not
mean Disconnect HID; use the latter for this complete workflow.

This workflow is implemented in the sample, not automatically by the SDK.
There is no public connector.disconnectHid or disconnectHidSafely method in
this release. Do not copy sample-private adapter access into a public API contract.

## Refresh And Close

While an adapter is open, the sample attempts cleanup on beforeunload, with
pagehide as a second trigger. It deduplicates overlapping attempts. A cancelled
navigation can still have started cleanup. Switching tabs alone does not invoke
this workflow; it does not stop output merely because the page becomes hidden.

Browsers do not await lifecycle promises and may suspend asynchronous work when
freezing or terminating a page. Consequently, refresh, tab close, process crash
or power loss cannot guarantee stop delivery or adapter cleanup completion.
Synthetic lifecycle tests verify ordering only, not physical delivery during
real termination. See the [Chrome page lifecycle guidance](https://developer.chrome.com/docs/web-platform/page-lifecycle-api).

Use explicit Disconnect HID and wait for the result before leaving when possible.
For a reliable hardware safety guarantee, the gateway or toy must implement a
communication timeout or equivalent device-side stop behavior. Do not describe
this as an existing SDK feature without verifying the intended hardware.

## Validation Checklist

- Cancel authorization, then reconnect successfully.
- Confirm Connect HID sends no toy scan or movement command.
- Discover repeatedly without another adapter permission prompt.
- Unplug the adapter with zero, one and multiple toys connected.
- Stop during queue execution and script playback.
- Confirm a failed stop does not prevent attempts for other toys.
- Test real refresh and close on each supported browser and adapter.
- Verify the deployed script includes connectHid and isHidConnected.

Continue with [Device Lifecycle](./device-flow.md), [Queues](./queues.md) and
[API Reference](./api-reference.md).
