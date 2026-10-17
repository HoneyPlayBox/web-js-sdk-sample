# Funscript Playback

Funscript loads a timeline and matches function tracks to connected toys.
Main playback controls omit toyId and operate on the matched group.
Device discovery and connections belong to connector.

## Load And Match

```javascript
const script = {
  tracks: [
    {
      id: "vibration",
      function: HoneyPlayBox.OpenSDK.ToyFunctions.Vibrate,
      actions: [{ at: 0, pos: 40 }, { at: 2000, pos: 0 }]
    },
    {
      id: "constriction",
      function: HoneyPlayBox.OpenSDK.ToyFunctions.Constrict,
      actions: [{ at: 0, pos: 60 }, { at: 3000, pos: 0 }]
    }
  ]
};
const json = await connector.Funscript.load(script);
const matching = connector.Funscript.getStatus();
await connector.Funscript.start();
```

A Vibrate-only toy executes only the vibration track. A Constrict-only toy executes
only the constriction track. A toy supporting both executes both in one combined
sample. Toys with no compatible tracks are excluded; loading fails if none match.
Matching uses capabilities, not a toy name or device ID embedded in the script.

Load accepts an object, JSON text or an HTTP/HTTPS URL and returns the actual JSON
text. URL downloads follow browser CORS rules. Downloads and document validation
finish before matched players are loaded. Connection failures during loading
are not transactional. Group load rejects
while a connected toy is playing; pause or stop first. Loading does not start
output or discard queues.

The group is selected at load time. Newly connected toys do not automatically join;
load again to include them. Without a group load, omitted-ID controls select
connected toys with individually loaded scripts.

## Track Format

| Field | Meaning |
| --- | --- |
| id | Required unique non-empty track identifier. |
| function | Required ToyFunctions value. |
| actions | Non-empty array of at/pos actions. |
| target | Optional Spots value; omit to use function defaults. |
| motor | Optional one-based index for document compatibility; prefer target/defaults. |
| inverted | Optional track inversion, combined with document inversion using XOR. |
| parameters.amplitude | Position amplitude, default 30 for tracks. |
| parameters.speed | Position speed, default 10. |

Actions require non-negative integer millisecond at values and pos from 0 to 100.
They are sorted; the last action at a duplicate timestamp wins. Unsupported
functions and unavailable targets are skipped with a reason. Duplicate IDs,
invalid actions and overlapping matched function targets reject loading.

All matched tracks on a toy share its clock. Total duration is the largest action
timestamp across all source tracks, including skipped tracks. A track holds its
last value until the whole script ends; end a track at zero when it should stop
earlier. Playback ends with a stop request.

Value-based functions map pos to value. Position and HwPositionWithDuration map
pos to centerPosition. Only supported functions are matched. Other document
metadata is retained, but arbitrary axes/channels metadata is not interpreted as
function tracks; range and metadata duration do not override action values or
timestamps.

## Root Actions

```javascript
await connector.Funscript.load({
  actions: [{ at: 0, pos: 0 }, { at: 1000, pos: 80 }, { at: 2000, pos: 0 }]
}, {
  function: HoneyPlayBox.OpenSDK.ToyFunctions.Vibrate
});
await connector.Funscript.start();
```

Root actions become the __main track. Options can select function, target and
position amplitude/speed (defaults 0 and 10 for root actions). Without function,
the player prefers supported Vibrate, then Position, then HwPositionWithDuration.
Root actions may coexist with tracks if their targets do not conflict.

## Controls

All time arguments are milliseconds. Group operations return arrays of per-toy
statuses, even for a single participant. Load returns JSON text instead.

| Method on connector.Funscript | Behavior |
| --- | --- |
| load(source, options) | Match and load, without starting. |
| start() | Start from zero in ready, stopped or ended state. |
| pause() | Freeze position, drain writes and stop output. |
| resume() | Resume paused participants, preserving position and rate. |
| restart() | Start the loaded script again from zero. |
| stop() | Stop output, reset to zero and retain the script. |
| seek(positionMs) | Absolute time change, clamped to duration. |
| jump(offsetMs) | Relative time change. |
| setPlaybackRate(rate) | Set rate from 0.1 through 4. |
| synchronizeTime(timeMs) | Align to authoritative media position. |
| getStatus() | Synchronously read participant status arrays. |

```javascript
await connector.Funscript.pause();
await connector.Funscript.seek(500);
await connector.Funscript.setPlaybackRate(1.5);
await connector.Funscript.resume();
await connector.Funscript.synchronizeTime(video.currentTime * 1000);
await connector.Funscript.stop();
```

The video variable represents application-owned media. Calibration takes media
time, not a Unix timestamp. It does not measure transport latency. Seek and
calibration preserve active playback; while not playing they do not move the toy.
Use resume after pause, not start.

## Participants And Failures

Start, resume and restart replace scheduling for participating toys. Group pause,
resume and stop exclude toys now owned by Immediate or Queue. Disconnected or
unloaded toys are excluded. An empty eligible group rejects without writing.
Loading alone does not make a toy eligible for group pause/stop; start playback
first.

Start/resume state validation occurs before group dispatch. Operations await all
participants; a failure rejects with AggregateError and failures entries
containing toyId and error. Other participants are still processed. This is not
an atomic device transaction or a guarantee of identical physical start times.

## Optional Single-Toy Overloads

For applications requiring individual control, load(toyId, source, options) and
control methods with toyId first remain supported. Explicit-ID controls return
one status instead of an array. getDocument(toyId) returns that toy's detached
original document, or null. Explicit-ID controls require the corresponding
loaded/connected toy.

Do not mistake omitted-ID Funscript behavior for omitted-ID Immediate behavior:
Immediate requires a target in multi-toy applications.

## Timing And Events

The browser player uses a monotonic clock and linear interpolation. It attempts
samples approximately every 50ms plus write time and skips unchanged rounded
values. All active tracks on a toy are written as one coherent sample. Slow
transports skip stale samples rather than building a delayed command queue.
No action is sent before its first timestamp. Progress events occur approximately
every 250ms while active; background throttling may delay them.

Disconnect interrupts playback; reconnect does not automatically resume it.
Status describes SDK timing and writes, not physical actuator confirmation.
See [Events](./events.md) for funscriptstate and track match fields.
