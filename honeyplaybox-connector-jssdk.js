const DeviceResponseStatus = Object.freeze({
  success: "success",
  invalidCommand: "invalidCommand",
  lengthError: "lengthError",
  dataCrcError: "dataCrcError",
  dataMacError: "dataMacError",
  invalidRandom: "invalidRandom",
  handshakeRequired: "handshakeRequired",
  unsupportedAlgorithm: "unsupportedAlgorithm",
  rsaError: "rsaError",
  unknown: "unknown"
});

const DeviceNotificationType = Object.freeze({
  airPressureParameters: "airPressureParameters",
  pressure: "pressure",
  depth: "depth",
  temperature: "temperature",
  steps: "steps",
  acceleration: "acceleration",
  unknown: "unknown"
});

const ToyFunctions = Object.freeze({
  Vibrate: "Vibrate",
  Rotate: "Rotate",
  Oscillate: "Oscillate",
  Constrict: "Constrict",
  Spray: "Spray",
  Temperature: "Temperature",
  Led: "Led",
  Position: "Position",
  HwPositionWithDuration: "HwPositionWithDuration"
});

const ToyCommandMode = Object.freeze({
  normal: "normal",
  queue: "queue"
});

const Spots = Object.freeze({
  C: "c",
  G: "g",
  A: "a",
  U: "u",
  O: "o",
  P: "p"
});

const ToyBleProtocols = Object.freeze({
  hpbV1: "hpb-v1",
  hpbU: "hpb-u"
});

const TOY_FUNCTION_WORK_MODES = Object.freeze({
  [ToyFunctions.Vibrate]: 1,
  [ToyFunctions.Constrict]: 2,
  [ToyFunctions.Position]: 3,
  [ToyFunctions.HwPositionWithDuration]: 3
});

const SDK_PROTOCOL_WASM_URL = "//sdk.honeyplaybox.com/prod/native-sdk/jssdk/protocol.wasm";
const HPB_FRAME_STX = 0x02;
const HPB_FRAME_ETX = 0x03;
const HPB_FRAME_FLAG = [0xa5, 0x5a, 0x55, 0xaa, 0xf0];
const TYPE_DEVICE = 0xb1;
const CMD_U_CUP_CUSTOM = 0x10;
let hpbFrameCounter = 0x09;

const DEFAULT_CONFIG = Object.freeze({
  serviceUuid: "",
  writeCharacteristic: "",
  readCharacteristic: "",
  batteryServiceUuid: "",
  batteryLevelUuid: "",
  frameStx: 0,
  frameFlag: [],
  configPath: "//sdk.honeyplaybox.com/prod/product/config.json",
  protocolWasmUrl: SDK_PROTOCOL_WASM_URL,
  autoReconnect: true,
  reconnectMaxAttempts: 5,
  reconnectDelayMs: 1000,
  reconnectFailurePauseMs: 2000,
  reconnectMaxDelayMs: 10000,
  discoveryAcceptAllDevices: false,
  commandMode: ToyCommandMode.normal,
  avatar: "//sdk.honeyplaybox.com/prod/product/logo/default.png",
  bleProtocol: ToyBleProtocols.hpbV1,
  features: {
    [ToyFunctions.Vibrate]: {
      default: [1],
      minCount: 1,
      syncGroup: []
    }
  },
  motors: {
    strength: {
      min: 0,
      max: 100
    },
    minCount: 1,
    count: 2
  },
  feedback: {
    battery: [
      {
        markers: ["01"],
        markerOffset: 0,
        valueOffset: 1,
        valueLength: 1,
        unit: "percent",
        min: 0,
        max: 100
      },
      {
        commands: ["04"],
        valueOffset: 0,
        valueLength: 1,
        unit: "percent",
        min: 0,
        max: 100
      },
      {
        responseCodes: ["0401"],
        valueOffset: 2,
        valueLength: 1,
        unit: "percent",
        min: 0,
        max: 100
      }
    ],
    pressure: [
      {
        markers: ["02"],
        markerOffset: 0,
        valueOffset: 1,
        valueLength: 2,
        endian: "big",
        scale: 0.1,
        unit: "value"
      },
      {
        commands: ["05"],
        valueOffset: 0,
        valueLength: 2,
        endian: "big",
        scale: 0.1,
        unit: "value"
      },
      {
        responseCodes: ["0501", "0402"],
        valueOffset: 2,
        valueLength: 2,
        endian: "big",
        scale: 0.1,
        unit: "value"
      }
    ]
  }
});

class ToyDeviceConfig {
  constructor(source = {}) {
    this.source = source;
    this.loaded = false;
    this.devices = [];
    this.baseUrl = "";
  }

  async load() {
    if (this.loaded) {
      return this;
    }

    if (typeof this.source === "string") {
      await this.loadFromPath(this.source);
    } else {
      this.loadFromObject(this.source);
    }

    this.loaded = true;
    return this;
  }

  async loadFromPath(path) {
    if (!path) {
      this.devices = [];
      return;
    }
    if (typeof fetch !== "function") {
      throw new Error("Toy config path loading requires fetch.");
    }
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Failed to load toy config: ${response.status}`);
    }
    this.loadFromObject(await response.json());
  }

  loadFromObject(config = {}) {
    const normalizedConfig = config || {};
    this.baseUrl = typeof normalizedConfig.baseUrl === "string" ? normalizedConfig.baseUrl : "";
    const devices = this.parseDeviceEntries(normalizedConfig);
    this.devices = devices.map((device) => this.normalizeDevice(device));
  }

  parseDeviceEntries(config) {
    if (Array.isArray(config)) {
      return config;
    }
    if (Array.isArray(config.devices)) {
      return config.devices;
    }
    if (Array.isArray(config.toys)) {
      return config.toys;
    }
    return Object.entries(config)
      .filter(([key, profile]) => key !== "baseUrl" && profile && typeof profile === "object")
      .map(([bluetoothName, profile]) => ({
        ...profile,
        bleName: profile.bleName || profile.bluetoothName || bluetoothName
      }));
  }

  findByBluetoothName(bluetoothName = "") {
    const normalizedName = this.normalizeName(bluetoothName);
    if (!normalizedName) {
      return null;
    }
    return this.devices.find((device) => this.matchesDevice(device, normalizedName)) || null;
  }

  createToyConfig(baseConfig, bluetoothName = "") {
    const profile = this.findByBluetoothName(bluetoothName);
    return {
      ...baseConfig,
      ...(profile || {}),
      bleName: profile?.bleName || bluetoothName,
      bluetoothName
    };
  }

  normalizeDevice(device = {}) {
    const bleName = device.bleName || device.bluetoothName || "";
    const motors = normalizeMotorsConfig(
      device.motors ?? { count: device.motorCount ?? DEFAULT_CONFIG.motors.count },
      DEFAULT_CONFIG.motors
    );
    const motorCount = motors.count;
    const bleProtocol = normalizeBleProtocol(device.bleProtocol ?? DEFAULT_CONFIG.bleProtocol);
    const featureSettings = normalizeFeatureSettings(device.features ?? DEFAULT_CONFIG.features, motorCount, motors);
    return {
      ...device,
      bleName,
      bleProtocol,
      // U-type cup products expose only position control to integrations, even
      // if an older product config still used a legacy oscillation label.
      features: normalizeProtocolFeatures(bleProtocol, normalizeToyFeatures(device.features, DEFAULT_CONFIG.features)),
      featureSettings,
      motors,
      motorCount,
      functionMotors: buildFunctionMotors(motors, motorCount),
      vibrationMotorMinCount: normalizeMotorMinCount(
        featureSettings[ToyFunctions.Vibrate]?.minCount ??
        motors.minCount ??
        device.vibrationMotorMinCount ??
        DEFAULT_CONFIG.motors.minCount,
        motorCount
      ),
      vibrationMotorSyncGroups: normalizeMotorSyncGroups(
        featureSettings[ToyFunctions.Vibrate]?.syncGroup ??
        featureSettings[ToyFunctions.Vibrate]?.syncGroups ??
        device.vibrationMotorSyncGroups ??
        DEFAULT_CONFIG.features[ToyFunctions.Vibrate]?.syncGroup,
        motorCount
      ),
      vibrationStrengthMin: Number(
        motors.strength?.min ?? device.vibrationStrengthMin ?? DEFAULT_CONFIG.motors.strength.min
      ),
      vibrationStrengthMax: Number(
        motors.strength?.max ?? device.vibrationStrengthMax ?? DEFAULT_CONFIG.motors.strength.max
      ),
      avatar: this.resolveConfigUrl(device.avatar || "")
    };
  }

  matchesDevice(device, normalizedName) {
    const bleName = this.normalizeName(device.bleName);
    const aliases = Array.isArray(device.aliases) ? device.aliases : [];
    const configuredNames = [bleName, ...aliases.map((name) => this.normalizeName(name))].filter(Boolean);
    return configuredNames.some((name) => normalizedName === name);
  }

  normalizeName(value = "") {
    return String(value).trim().toLowerCase();
  }

  resolveConfigUrl(value = "") {
    if (!value) {
      return "";
    }
    if (/^(https?:|data:|blob:)/i.test(value)) {
      return value;
    }
    if (!this.baseUrl) {
      return value;
    }
    const base = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`;
    const path = String(value).replace(/^\/+/, "");
    return `${base}${path}`;
  }
}

class Toy extends EventTarget {
  constructor({ connector, device, server, writeCharacteristic, readCharacteristic, config }) {
    super();
    this.connector = connector;
    this.device = device;
    this.server = server;
    this.writeCharacteristic = writeCharacteristic;
    this.readCharacteristic = readCharacteristic;
    this.config = config;
    this.batteryCharacteristic = null;
    this.batteryLevel = null;
    this.sessionRandom = null;
    this.notificationBuffer = [];
    this.randomWaiters = [];
    this.deviceInfoWaiters = [];
    this.manualDisconnectRequested = false;
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.commandStopTimer = null;
    this.gattWriteChain = Promise.resolve();
    this.commandMode = normalizeCommandMode(config.commandMode);
    this.commandQueue = [];
    this.commandQueueRunning = false;
    this.commandQueueActiveId = null;
    this.commandQueueVersion = 0;
    this.commandQueueCounter = 0;
    this.reconnecting = false;
    this.handleNotification = this.handleNotification.bind(this);
    this.handleBatteryNotification = this.handleBatteryNotification.bind(this);
    this.handleDisconnected = this.handleDisconnected.bind(this);
  }

  async getProtocol() {
    return this.connector.getProtocol(this.config.bleProtocol);
  }

  get id() {
    return this.device.id;
  }

  get toyId() {
    return this.device.id;
  }

  get name() {
    return this.config.name || "HoneyPlayBox Toy";
  }

  get avatar() {
    return this.config.avatar;
  }

  get features() {
    return [...this.config.features];
  }

  get motorCount() {
    return this.config.motorCount;
  }

  get connected() {
    return Boolean(this.device.gatt?.connected);
  }

  async initializeNotifications() {
    this.device.removeEventListener("gattserverdisconnected", this.handleDisconnected);
    this.readCharacteristic?.removeEventListener("characteristicvaluechanged", this.handleNotification);
    this.device.addEventListener("gattserverdisconnected", this.handleDisconnected);
    this.readCharacteristic.addEventListener("characteristicvaluechanged", this.handleNotification);
    await this.readCharacteristic.startNotifications();
    await this.initializeBatteryService();
    await this.initializeToySession();
    return this;
  }

  async disconnect() {
    this.manualDisconnectRequested = true;
    this.clearReconnectTimer();
    await this.cleanupNotifications();
    this.device.removeEventListener("gattserverdisconnected", this.handleDisconnected);
    if (this.device.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.connector.removeToy(this.id);
    const detail = { ...this.toJSON(), manual: true, autoReconnect: false };
    this.dispatchEvent(new CustomEvent("disconnect", { detail }));
    this.connector.dispatchEvent(new CustomEvent("disconnect", { detail }));
  }

  async cleanupNotifications() {
    this.clearCommandStopTimer();
    this.readCharacteristic?.removeEventListener("characteristicvaluechanged", this.handleNotification);
    await this.readCharacteristic?.stopNotifications().catch(() => undefined);
    this.batteryCharacteristic?.removeEventListener("characteristicvaluechanged", this.handleBatteryNotification);
    await this.batteryCharacteristic?.stopNotifications().catch(() => undefined);
    this.batteryCharacteristic = null;
    this.randomWaiters.splice(0).forEach(({ reject }) => reject(new Error("Toy disconnected.")));
    this.deviceInfoWaiters.splice(0).forEach(({ reject }) => reject(new Error("Toy disconnected.")));
  }

  async sendCommand(commands = {}) {
    return this.sendCommandPayload(commands);
  }

  setCommandMode(mode) {
    const nextMode = normalizeCommandMode(mode);
    if (nextMode !== this.commandMode) {
      const previousMode = this.commandMode;
      this.commandMode = nextMode;
      const removedCount = this.clearCommandQueue("modeChange");
      this.dispatchQueueChange("modeChange", {
        previousMode,
        mode: this.commandMode,
        removedCount
      });
    }
    return this.commandMode;
  }

  clearCommandQueue(reason = "clear") {
    this.commandQueueVersion += 1;
    const removedCount = this.commandQueue.length;
    const error = new Error("Command queue cleared.");
    this.commandQueue.splice(0).forEach((entry) => entry.reject?.(error));
    this.commandQueueRunning = false;
    this.commandQueueActiveId = null;
    this.dispatchQueueChange("clear", { reason, removedCount });
    return removedCount;
  }

  getCommandQueue() {
    return this.commandQueue.map((entry, index) => ({
      commandId: entry.commandId,
      toyId: this.id,
      name: this.name,
      commands: entry.commands,
      commandCount: entry.commands.length,
      queuedAt: entry.queuedAt,
      position: index + 1,
      status: entry.commandId === this.commandQueueActiveId ? "running" : "waiting"
    }));
  }

  removeCommand(commandId) {
    const index = this.commandQueue.findIndex((entry) => entry.commandId === commandId);
    if (index < 0) {
      return false;
    }
    if (this.commandQueue[index].commandId === this.commandQueueActiveId) {
      return false;
    }
    const [entry] = this.commandQueue.splice(index, 1);
    entry.reject?.(new Error("Command removed from queue."));
    this.dispatchQueueChange("remove", {
      commandId,
      commands: entry.commands,
      removedCount: 1
    });
    return true;
  }

  dequeueCommandEntry(entry) {
    const index = this.commandQueue.findIndex((item) => item.commandId === entry.commandId);
    if (index >= 0) {
      this.commandQueue.splice(index, 1);
    }
    if (this.commandQueueActiveId === entry.commandId) {
      this.commandQueueActiveId = null;
    }
  }

  async stopCommand() {
    this.clearCommandStopTimer();
    const protocol = await this.getProtocol();
    const sessionRandom = await this.ensureSessionRandom();
    if (protocol.requiresSession === false) {
      const frame = protocol.buildStopFrame(sessionRandom);
      await this.writeTransportFrame(frame);
      const detail = {
        toyId: this.id,
        name: this.name,
        commands: [
          {
            duration: 0,
            function: ToyFunctions.Position,
            centerPosition: 0,
            amplitude: 0,
            speed: 0
          }
        ],
        commandCount: 1,
        action: "stopCommand",
        time: Date.now()
      };
      this.dispatchCommand(detail);
      return detail;
    }
    const commands = createProtocolStopCommands(this.id, this.config);
    const frames = buildProtocolCommandFrames(protocol, commands, sessionRandom);
    for (const frame of frames) {
      await this.writeFrame(frame);
      await delay(20);
    }
    const detail = {
      toyId: this.id,
      name: this.name,
      commands: [
        {
          value: 0,
          duration: 0,
          function: ToyFunctions.Vibrate
        }
      ],
      commandCount: 1,
      action: "stopCommand",
      time: Date.now()
    };
    this.dispatchCommand(detail);
    return detail;
  }

  async writeTransportFrame(bytes) {
    const frame = toUint8Array(bytes);
    // Internal raw frame writes are intentionally silent to avoid exposing protocol bytes.
    await this.writeFrame(frame);
    return {
      toyId: this.id,
      name: this.name,
      action: "writeTransportFrame",
      commandCount: 1,
      time: Date.now()
    };
  }

  async readBatteryLevel() {
    if (!this.batteryCharacteristic) {
      await this.initializeBatteryService();
    }
    if (!this.batteryCharacteristic) {
      const deviceInfo = await this.requestDeviceInfo().catch(() => null);
      return deviceInfo?.batteryLevel ?? this.batteryLevel;
    }
    const value = await this.batteryCharacteristic.readValue();
    this.dispatchBatteryLevel(value);
    return this.batteryLevel;
  }

  async sendCommandPayload(options = {}) {
    if (this.commandMode === ToyCommandMode.queue) {
      return this.enqueueCommandPayload(options);
    }
    return this.sendCommandPayloadNow(options);
  }

  enqueueCommandPayload(options = {}) {
    const commands = normalizePublicCommandList(options);
    const entry = {
      commandId: this.createCommandQueueId(),
      options,
      commands,
      queuedAt: Date.now()
    };
    this.commandQueue.push(entry);
    this.dispatchQueueChange("enqueue", {
      commandId: entry.commandId,
      commands: entry.commands
    });
    this.processCommandQueue();
    return Promise.resolve({
      toyId: this.id,
      name: this.name,
      commandId: entry.commandId,
      commands: entry.commands,
      commandCount: entry.commands.length,
      status: "queued",
      queuedAt: entry.queuedAt,
      time: Date.now()
    });
  }

  createCommandQueueId() {
    this.commandQueueCounter += 1;
    return `command-${this.commandQueueCounter}`;
  }

  async processCommandQueue() {
    if (this.commandQueueRunning) {
      return;
    }
    const queueVersion = this.commandQueueVersion;
    this.commandQueueRunning = true;
    while (
      queueVersion === this.commandQueueVersion &&
      this.commandMode === ToyCommandMode.queue &&
      this.commandQueue.length
    ) {
      const entry = this.commandQueue[0];
      this.commandQueueActiveId = entry.commandId;
      this.dispatchQueueChange("start", {
        commandId: entry.commandId,
        commands: entry.commands
      });
      try {
        const result = await this.sendCommandPayloadNow(entry.options, entry);
        await delay(getCommandQueueDelay(result.commands));
        if (queueVersion !== this.commandQueueVersion) {
          break;
        }
        // Only the finished execution unit leaves the queue; waiting units stay queued.
        this.dequeueCommandEntry(entry);
        this.dispatchQueueChange("complete", {
          commandId: entry.commandId,
          commands: entry.commands
        });
        entry.resolve?.(result);
      } catch (error) {
        // Keep later queued units intact when the active unit fails.
        this.dequeueCommandEntry(entry);
        entry.reject?.(error);
        this.dispatchQueueChange("failed", {
          commandId: entry.commandId,
          commands: entry.commands,
          message: error?.message || String(error)
        });
        break;
      }
    }
    if (queueVersion === this.commandQueueVersion) {
      this.commandQueueRunning = false;
    }
  }

  async sendCommandPayloadNow(options = {}, queueEntry = null) {
    this.clearCommandStopTimer();
    const protocol = await this.getProtocol();
    const inputCommands = normalizeCommandList(options);
    const rawCommands = inputCommands.flatMap((command) =>
      normalizeToyCommand(command, this.id, this.config)
    );
    const commands = applyMotorSyncRules(rawCommands, this.config);
    const publicCommands = normalizePublicCommandList(options);
    this.dispatchDebug("command:normalized", {
      inputCommands,
      normalizedCommands: commands.map(createCommandDebugDetail),
      publicCommands,
      commandMode: this.commandMode
    });
    const frames = buildProtocolCommandFrames(protocol, commands, await this.ensureSessionRandom());
    frames.forEach((frame, index) => {
      this.dispatchDebug("command:frame", {
        frameIndex: index,
        frameCount: frames.length,
        frameType: frame[7],
        frameCommand: frame[8],
        frameLength: frame.length
      });
    });
    if (protocol.rawCommandWrite) {
      await this.writeTransportFrame(frames[0]);
    } else {
      this.dispatchDebug("command:write:start");
      for (const frame of frames) {
        await this.writeFrame(frame);
        await delay(30);
      }
      this.dispatchDebug("command:write:done");
    }
    this.scheduleTimedCommandStop(protocol, commands);
    const detail = {
      toyId: this.id,
      name: this.name,
      ...(queueEntry ? { commandId: queueEntry.commandId } : {}),
      commands: publicCommands,
      commandCount: publicCommands.length,
      time: Date.now()
    };
    this.dispatchCommand(detail);
    return detail;
  }

  dispatchDebug(stage, detail = {}) {
    // Debug event emission is disabled because it can reveal private protocol details.
  }

  onFeedback(callback) {
    const listener = (event) => callback(event.detail);
    this.addEventListener("feedback", listener);
    return () => this.removeEventListener("feedback", listener);
  }

  toJSON() {
    return {
      toyId: this.id,
      name: this.name,
      avatar: this.avatar,
      features: this.features,
      motorCount: this.motorCount,
      batteryLevel: this.batteryLevel,
      connected: this.connected,
      autoReconnect: Boolean(this.config.autoReconnect),
      commandMode: this.commandMode,
      queuedCommandCount: this.commandQueue.length,
      reconnecting: this.reconnecting,
      reconnectAttempt: this.reconnectAttempt,
      transport: "ble-wasm"
    };
  }

  async initializeBatteryService() {
    try {
      const service = await this.server.getPrimaryService(this.config.batteryServiceUuid);
      this.batteryCharacteristic = await service.getCharacteristic(this.config.batteryLevelUuid);
      this.batteryCharacteristic.addEventListener("characteristicvaluechanged", this.handleBatteryNotification);
      const value = await this.batteryCharacteristic.readValue();
      this.dispatchBatteryLevel(value);
      await this.batteryCharacteristic.startNotifications().catch(() => undefined);
    } catch {
      this.batteryCharacteristic = null;
    }
  }

  async initializeToySession() {
    const protocol = await this.getProtocol();
    if (protocol.requiresSession === false) {
      this.sessionRandom = new Uint8Array(16);
      return;
    }
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        // Some toys need a little more time after notifications start before
        // they reliably answer the session random request.
        await this.writeFrame(protocol.buildHandshakeFrame());
        await delay(attempt === 1 ? 600 : 900);
        if (!this.sessionRandom || this.sessionRandom.length !== 16) {
          await this.requestSessionRandom({ timeoutMs: 10000 });
        }
        await this.requestDeviceInfo().catch(() => undefined);
        return;
      } catch (error) {
        lastError = error;
        this.randomWaiters.splice(0).forEach(({ reject }) => reject(error));
        await delay(300 * attempt);
      }
    }
    throw lastError || new Error("Random response timed out.");
  }

  async ensureSessionRandom() {
    if (this.sessionRandom?.length === 16) {
      return this.sessionRandom;
    }
    const protocol = await this.getProtocol();
    if (protocol.requiresSession === false) {
      this.sessionRandom = new Uint8Array(16);
      return this.sessionRandom;
    }
    return this.requestSessionRandom();
  }

  async requestSessionRandom({ timeoutMs = 10000 } = {}) {
    if (this.sessionRandom?.length === 16) {
      return this.sessionRandom;
    }
    const protocol = await this.getProtocol();
    const waiter = this.createNotificationWaiter(this.randomWaiters, timeoutMs, "Random response timed out.");
    await this.writeFrame(protocol.buildRandomRequestFrame());
    return waiter;
  }

  async requestDeviceInfo() {
    const protocol = await this.getProtocol();
    const waiter = this.createNotificationWaiter(this.deviceInfoWaiters, 3000, "Device info response timed out.");
    await this.writeFrame(protocol.buildDeviceInfoRequestFrame());
    return waiter;
  }

  createNotificationWaiter(waiters, timeoutMs, timeoutMessage) {
    return new Promise((resolve, reject) => {
      const entry = {
        resolve: (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        }
      };
      const timer = setTimeout(() => {
        const index = waiters.indexOf(entry);
        if (index >= 0) {
          waiters.splice(index, 1);
        }
        reject(new Error(timeoutMessage));
      }, timeoutMs);
      waiters.push(entry);
    });
  }

  resolveWaiters(waiters, value) {
    waiters.splice(0).forEach(({ resolve }) => resolve(value));
  }

  async writeFrame(frame) {
    if (!this.connected) {
      throw new Error("Toy is disconnected. Reconnect before writing.");
    }
    const previousWrite = this.gattWriteChain.catch(() => undefined);
    const currentWrite = previousWrite.then(() => this.writeFrameNow(frame));
    this.gattWriteChain = currentWrite.catch(() => undefined);
    return currentWrite;
  }

  async writeFrameNow(frame) {
    if (!this.connected) {
      throw new Error("Toy is disconnected. Reconnect before writing.");
    }
    const protocol = await this.getProtocol();
    const properties = this.writeCharacteristic.properties || {};
    try {
      if (protocol.preferWriteWithoutResponse && properties.writeWithoutResponse && this.writeCharacteristic.writeValueWithoutResponse) {
        this.dispatchDebug("command:write:method", { method: "writeValueWithoutResponse", properties: getCharacteristicProperties(properties) });
        await this.writeCharacteristic.writeValueWithoutResponse(frame);
        return;
      }
      if (properties.write && this.writeCharacteristic.writeValueWithResponse) {
        this.dispatchDebug("command:write:method", { method: "writeValueWithResponse", properties: getCharacteristicProperties(properties) });
        await this.writeCharacteristic.writeValueWithResponse(frame);
        return;
      }
      if (properties.writeWithoutResponse && this.writeCharacteristic.writeValueWithoutResponse) {
        this.dispatchDebug("command:write:method", { method: "writeValueWithoutResponse", properties: getCharacteristicProperties(properties) });
        await this.writeCharacteristic.writeValueWithoutResponse(frame);
        return;
      }
      this.dispatchDebug("command:write:method", { method: "writeValue", properties: getCharacteristicProperties(properties) });
      await this.writeCharacteristic.writeValue(frame);
    } catch (error) {
      this.dispatchDebug("command:write:error", {
        message: error?.message || String(error),
        connected: this.connected
      });
      throw error;
    }
  }

  handleBatteryNotification(event) {
    this.dispatchBatteryLevel(event.target.value);
  }

  dispatchBatteryLevel(value) {
    const batteryLevel = clampFeedbackValue(Number(value.getUint8(0)), { min: 0, max: 100 });
    this.batteryLevel = batteryLevel;
    this.dispatchFeedback({
      kind: "battery",
      value: batteryLevel,
      unit: "percent"
    });
  }

  async handleNotification(event) {
    const protocol = await this.getProtocol();
    const raw = new Uint8Array(event.target.value.buffer.slice(0));
    const frames = feedAndCollectFrames(this.notificationBuffer, raw, this.config);
    const chunks = frames.length ? frames : [raw];
    for (const chunk of chunks) {
      const frame = protocol.parseFrame(chunk);
      const sessionFeedback = this.handleSessionFrame(frame);
      if (sessionFeedback) {
        this.dispatchFeedback(sessionFeedback);
        continue;
      }
      const notification = this.decodeFeedback(protocol, chunk, frame);
      this.dispatchFeedback(notification);
    }
  }

  decodeFeedback(protocol, chunk, frame) {
    if (frame?.command === 0x08) {
      const notification = protocol.parseDeviceNotification(frame.payload);
      return {
        kind: notification.kind || "unknown",
        value: notification.value,
        unit: notification.unit,
        responseStatus: notification.responseStatus,
        incomplete: Boolean(notification.incomplete)
      };
    }

    const inlineNotification = decodeInlineNotificationFeedback(protocol, frame);
    if (inlineNotification) {
      return inlineNotification;
    }

    const genericFeedback = decodeGenericFeedback(frame, this.config.feedback);
    if (genericFeedback) {
      return genericFeedback;
    }

    const notification = protocol.parseDeviceNotification(chunk);
    return {
      kind: notification.kind || "unknown",
      value: notification.value,
      unit: notification.unit,
      responseStatus: notification.responseStatus,
      incomplete: Boolean(notification.incomplete)
    };
  }

  handleSessionFrame(frame) {
    if (!frame?.crcOk) {
      return null;
    }
    if (frame.command === 0x01) {
      const random = extractSessionRandom(frame);
      if (random) {
        this.sessionRandom = random;
        this.resolveWaiters(this.randomWaiters, random);
      }
      return {
        kind: "response",
        notificationType: "random",
        responseStatus: frame.responseStatus,
        value: random ? "ready" : null,
        unit: null
      };
    }
    if (frame.command === 0x02) {
      const deviceInfo = parseDeviceInfoPayload(frame.payload);
      if (deviceInfo) {
        this.batteryLevel = deviceInfo.batteryLevel;
        this.resolveWaiters(this.deviceInfoWaiters, deviceInfo);
        return {
          kind: "battery",
          value: deviceInfo.batteryLevel,
          unit: "percent",
          responseStatus: deviceInfo.responseStatus
        };
      }
    }
    return null;
  }

  dispatchFeedback(feedback) {
    if (!shouldDispatchFeedback(feedback)) {
      return;
    }
    const detail = {
      toyId: this.id,
      name: this.name,
      kind: feedback?.kind || "unknown",
      value: feedback?.value ?? null,
      unit: feedback?.unit || null,
      time: Date.now()
    };
    this.dispatchEvent(new CustomEvent("feedback", { detail }));
    this.connector.dispatchEvent(new CustomEvent("feedback", { detail }));
  }

  dispatchCommand(detail) {
    this.connector.dispatchEvent(new CustomEvent("command", { detail }));
    this.dispatchEvent(new CustomEvent("command", { detail }));
  }

  dispatchQueueChange(action, extra = {}) {
    const detail = {
      toyId: this.id,
      name: this.name,
      action,
      commandMode: this.commandMode,
      queuedCommandCount: this.commandQueue.length,
      queue: this.getCommandQueue(),
      time: Date.now(),
      ...extra
    };
    this.connector.dispatchEvent(new CustomEvent("queuechange", { detail }));
    this.dispatchEvent(new CustomEvent("queuechange", { detail }));
  }

  onQueueChange(callback) {
    const listener = (event) => callback(event.detail);
    this.addEventListener("queuechange", listener);
    return () => this.removeEventListener("queuechange", listener);
  }

  clearCommandStopTimer() {
    if (this.commandStopTimer) {
      clearTimeout(this.commandStopTimer);
      this.commandStopTimer = null;
    }
  }

  scheduleTimedCommandStop(protocol, commands = []) {
    if (protocol.requiresSession === false) {
      return;
    }
    const delayMs = getTimedCommandStopDelay(commands);
    if (delayMs <= 0) {
      return;
    }
    this.commandStopTimer = setTimeout(() => {
      this.commandStopTimer = null;
      if (!this.connected) {
        return;
      }
      this.stopCommand().catch((error) => {
        this.connector.dispatchEvent(new CustomEvent("error", {
          detail: {
            toyId: this.id,
            name: this.name,
            message: error?.message || String(error),
            time: Date.now()
          }
        }));
      });
    }, delayMs);
  }

  handleDisconnected() {
    const detail = { ...this.toJSON(), manual: this.manualDisconnectRequested, autoReconnect: Boolean(this.config.autoReconnect) };
    this.dispatchEvent(new CustomEvent("disconnect", { detail }));
    this.connector.dispatchEvent(new CustomEvent("disconnect", { detail }));
    if (this.manualDisconnectRequested || !this.config.autoReconnect) {
      this.connector.removeToy(this.id);
      return;
    }
    this.scheduleReconnect();
  }

  scheduleReconnect(delayOverrideMs = null) {
    if (this.reconnecting || this.reconnectTimer) {
      return;
    }
    const maxAttempts = Number(this.config.reconnectMaxAttempts ?? DEFAULT_CONFIG.reconnectMaxAttempts);
    if (Number.isFinite(maxAttempts) && maxAttempts <= 0) {
      this.connector.removeToy(this.id);
      return;
    }
    if (Number.isFinite(maxAttempts) && maxAttempts > 0 && this.reconnectAttempt >= maxAttempts) {
      this.connector.removeToy(this.id);
      this.dispatchConnectState({ ...this.toJSON(), status: "reconnectStopped", attempt: this.reconnectAttempt, maxAttempts });
      return;
    }
    const delayMs = delayOverrideMs === null
      ? this.getReconnectDelay()
      : Math.max(0, Number(delayOverrideMs));
    this.dispatchConnectState({ ...this.toJSON(), status: "reconnecting", attempt: this.reconnectAttempt + 1, delay: delayMs });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnect().catch(() => {
        const failurePauseMs = Number(this.config.reconnectFailurePauseMs ?? DEFAULT_CONFIG.reconnectFailurePauseMs);
        this.scheduleReconnect(Number.isFinite(failurePauseMs) ? failurePauseMs : DEFAULT_CONFIG.reconnectFailurePauseMs);
      });
    }, delayMs);
  }

  getReconnectDelay() {
    const baseDelay = Math.max(0, Number(this.config.reconnectDelayMs ?? DEFAULT_CONFIG.reconnectDelayMs));
    const maxDelay = Math.max(baseDelay, Number(this.config.reconnectMaxDelayMs ?? DEFAULT_CONFIG.reconnectMaxDelayMs));
    return Math.min(maxDelay, baseDelay * 2 ** this.reconnectAttempt);
  }

  clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  async reconnect() {
    if (this.manualDisconnectRequested || this.reconnecting) {
      return this;
    }
    this.reconnecting = true;
    this.reconnectAttempt += 1;
    try {
      await this.cleanupNotifications();
      const server = await this.device.gatt.connect();
      const service = await server.getPrimaryService(this.config.serviceUuid);
      this.server = server;
      this.writeCharacteristic = await service.getCharacteristic(this.config.writeCharacteristic);
      this.readCharacteristic = await service.getCharacteristic(this.config.readCharacteristic);
      await this.initializeNotifications();
      this.reconnectAttempt = 0;
      this.reconnecting = false;
      this.connector.connectedToys.set(this.id, this);
      this.dispatchConnectState({ ...this.toJSON(), status: "reconnected" });
      return this;
    } catch (error) {
      this.reconnecting = false;
      this.dispatchConnectState({ ...this.toJSON(), status: "reconnectError", attempt: this.reconnectAttempt, message: error.message });
      throw error;
    }
  }

  dispatchConnectState(detail) {
    const connectDetail = { ...detail, time: detail.time ?? Date.now() };
    this.dispatchEvent(new CustomEvent("connect", { detail: connectDetail }));
    this.connector.dispatchEvent(new CustomEvent("connect", { detail: connectDetail }));
  }
}

class ToyConnector extends EventTarget {
  constructor(options = {}) {
    super();
    const connectorOptions = { ...options };
    delete connectorOptions.configPath;
    delete connectorOptions.deviceConfig;
    delete connectorOptions.toyConfig;
    this.config = { ...DEFAULT_CONFIG, ...connectorOptions, configPath: DEFAULT_CONFIG.configPath };
    this.deviceConfig = new ToyDeviceConfig(this.config.configPath);
    this.discoveredDevices = new Map();
    this.connectedToys = new Map();
    this.protocolPromises = new Map();
  }

  static async isBleSupported() {
    if (!("bluetooth" in navigator)) {
      return { supported: false, available: false };
    }
    const available = await navigator.bluetooth.getAvailability?.().catch(() => undefined);
    return { supported: true, available: available !== false };
  }

  async isBleSupported() {
    return ToyConnector.isBleSupported();
  }

  async getProtocol(bleProtocol = this.config.bleProtocol) {
    const protocolName = normalizeBleProtocol(bleProtocol);
    if (!this.protocolPromises.has(protocolName)) {
      this.protocolPromises.set(
        protocolName,
        createHoneyPlayBoxProtocolWasm({
          bleProtocol: protocolName,
          wasmUrl: this.config.protocolWasmUrl
        })
      );
    }
    return this.protocolPromises.get(protocolName);
  }

  async ensureWasmConfig() {
    const protocol = await this.getProtocol();
    this.config = {
      ...this.config,
      ...protocol.bleConfig,
      frameStx: protocol.frameStx,
      frameFlag: protocol.frameFlag
    };
    return this.config;
  }

  async discoverDevices() {
    this.assertBleApi();
    await this.loadDeviceConfig();
    await this.ensureWasmConfig();
    const device = await navigator.bluetooth.requestDevice(this.createDiscoveryRequestOptions());
    if (!this.isConfiguredDevice(device)) {
      return [];
    }
    this.discoveredDevices.set(device.id, device);
    const discovered = this.createDeviceSummary(device);
    this.dispatchEvent(new CustomEvent("discover", { detail: discovered }));
    return [discovered];
  }

  createDiscoveryRequestOptions() {
    const optionalServices = [this.config.serviceUuid, this.config.batteryServiceUuid].filter(Boolean);
    if (this.config.discoveryAcceptAllDevices) {
      // This opt-in fallback accepts all for authorization, then keeps SDK
      // results limited to configured toys through isConfiguredDevice().
      return {
        acceptAllDevices: true,
        optionalServices
      };
    }
    return {
      filters: this.createDiscoveryFilters(),
      optionalServices
    };
  }

  async connectDevice(toyId) {
    this.assertBleApi();
    await this.loadDeviceConfig();
    await this.ensureWasmConfig();
    const device = this.resolveDevice(toyId);
    if (this.connectedToys.has(device.id)) {
      return this.connectedToys.get(device.id);
    }
    const { server, writeCharacteristic, readCharacteristic } = await this.openToyGatt(device);
    const toy = new Toy({
      connector: this,
      device,
      server,
      writeCharacteristic,
      readCharacteristic,
      config: this.createToyConfig(device)
    });
    toy.dispatchDebug("connect:config", {
      bluetoothName: device.name || "",
      serviceUuid: this.config.serviceUuid,
      writeCharacteristic: this.config.writeCharacteristic,
      readCharacteristic: this.config.readCharacteristic,
      motorCount: toy.motorCount,
      motors: toy.config.motors
    });
    try {
      await toy.initializeNotifications();
    } catch (error) {
      await toy.cleanupNotifications().catch(() => undefined);
      device.removeEventListener("gattserverdisconnected", toy.handleDisconnected);
      if (device.gatt?.connected) {
        device.gatt.disconnect();
      }
      throw error;
    }
    await toy.readBatteryLevel().catch(() => undefined);
    this.connectedToys.set(device.id, toy);
    this.dispatchEvent(new CustomEvent("connect", { detail: { ...toy.toJSON(), status: "connected", time: Date.now() } }));
    return toy;
  }

  async openToyGatt(device) {
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const server = device.gatt?.connected && device.gatt
          ? device.gatt
          : await device.gatt.connect();
        if (!server?.connected && !device.gatt?.connected) {
          throw new Error("GATT server did not stay connected.");
        }
        // Some BLE adapters need a short settle time before service discovery.
        if (attempt > 1) {
          await delay(250 * attempt);
        }
        const service = await server.getPrimaryService(this.config.serviceUuid);
        const writeCharacteristic = await service.getCharacteristic(this.config.writeCharacteristic);
        const readCharacteristic = await service.getCharacteristic(this.config.readCharacteristic);
        return { server, writeCharacteristic, readCharacteristic };
      } catch (error) {
        lastError = error;
        if (device.gatt?.connected) {
          device.gatt.disconnect();
        }
        await delay(300 * attempt);
      }
    }
    throw lastError || new Error("Unable to connect GATT service.");
  }

  async sendCommand(toyId, commands = {}) {
    return this.resolveToy(toyId).sendCommand(commands);
  }

  setCommandMode(toyId, mode) {
    return this.resolveToy(toyId).setCommandMode(mode);
  }

  clearCommandQueue(toyId) {
    return this.resolveToy(toyId).clearCommandQueue();
  }

  getCommandQueue(toyId) {
    return this.resolveToy(toyId).getCommandQueue();
  }

  removeCommand(toyId, commandId) {
    return this.resolveToy(toyId).removeCommand(commandId);
  }

  async stopCommand(toyId) {
    return this.resolveToy(toyId).stopCommand();
  }

  async readBatteryLevel(toyId) {
    return this.resolveToy(toyId).readBatteryLevel();
  }

  async sendToyCommand(options = {}) {
    if (Array.isArray(options)) {
      const grouped = new Map();
      for (const command of options) {
        const toy = this.resolveToy(command.toyId);
        const commands = grouped.get(toy) || [];
        commands.push(command);
        grouped.set(toy, commands);
      }
      // Each Toy owns its own command queue, so grouped toy commands should be
      // submitted in parallel. A long queue on one toy must not block another toy.
      const results = await Promise.all(
        Array.from(grouped.entries(), ([toy, commands]) => toy.sendCommand(commands))
      );
      return results.length === 1 ? results[0] : results;
    }
    return this.resolveToy(options.toyId).sendCommand(options);
  }

  getConnectedToys() {
    return Array.from(this.connectedToys.values());
  }

  getToy(toyId) {
    return this.connectedToys.get(toyId) || null;
  }

  removeToy(toyId) {
    this.connectedToys.delete(toyId);
  }

  async disconnectDevice(toyId) {
    await this.resolveToy(toyId).disconnect();
  }

  onFeedback(callback) {
    const listener = (event) => callback(event.detail);
    this.addEventListener("feedback", listener);
    return () => this.removeEventListener("feedback", listener);
  }

  onQueueChange(callback) {
    const listener = (event) => callback(event.detail);
    this.addEventListener("queuechange", listener);
    return () => this.removeEventListener("queuechange", listener);
  }

  createDeviceSummary(device) {
    const toyConfig = this.createToyConfig(device);
    return {
      toyId: device.id,
      name: toyConfig.name || "HoneyPlayBox Toy",
      avatar: toyConfig.avatar,
      features: [...toyConfig.features],
      motorCount: toyConfig.motorCount,
      transport: "ble-wasm"
    };
  }

  createDiscoveryFilters() {
    const configuredNames = this.createConfiguredBleNames();
    if (!configuredNames.length) {
      return [{ services: [this.config.serviceUuid] }];
    }
    return configuredNames.map((name) => ({
      // Use exact configured BLE names only. Product matching after selection
      // also requires exact bleName or alias equality.
      name
    }));
  }

  createConfiguredBleNames() {
    const names = new Set();
    this.deviceConfig.devices.forEach((device) => {
      [device.bleName, ...(Array.isArray(device.aliases) ? device.aliases : [])]
        .map((name) => String(name || "").trim())
        .filter(Boolean)
        .forEach((name) => names.add(name));
    });
    return Array.from(names);
  }

  isConfiguredDevice(device) {
    return Boolean(this.deviceConfig.findByBluetoothName(device.name || ""));
  }

  async loadDeviceConfig() {
    await this.deviceConfig.load();
  }

  createToyConfig(device) {
    return this.deviceConfig.createToyConfig(this.config, device.name || "");
  }

  resolveDevice(toyId) {
    if (toyId && this.discoveredDevices.has(toyId)) {
      return this.discoveredDevices.get(toyId);
    }
    if (!toyId && this.discoveredDevices.size === 1) {
      return this.discoveredDevices.values().next().value;
    }
    throw new Error("BLE device is not discovered. Call discoverDevices() from a user click first.");
  }

  resolveToy(toyId) {
    if (toyId && this.connectedToys.has(toyId)) {
      return this.connectedToys.get(toyId);
    }
    if (!toyId && this.connectedToys.size === 1) {
      return this.connectedToys.values().next().value;
    }
    throw new Error("Toy is not connected.");
  }

  assertBleApi() {
    if (!("bluetooth" in navigator)) {
      throw new Error("Web Bluetooth is not supported by this browser.");
    }
  }
}

function createToyConnector(options) {
  return new ToyConnector(options);
}

async function isBleSupported() {
  return ToyConnector.isBleSupported();
}

function normalizeToyFeatures(values, fallback = DEFAULT_CONFIG.features) {
  const list = Array.isArray(values)
    ? values
    : values && typeof values === "object"
      ? Object.keys(values)
      : [];
  const fallbackList = Array.isArray(fallback)
    ? fallback
    : fallback && typeof fallback === "object"
      ? Object.keys(fallback)
      : [];
  const features = list
    .map((value) => normalizeToyFunction(value))
    .filter(Boolean);
  return features.length ? [...new Set(features)] : fallbackList.map(normalizeToyFunction).filter(Boolean);
}

function normalizeProtocolFeatures(bleProtocol, features) {
  return bleProtocol === ToyBleProtocols.hpbU ? [ToyFunctions.Position] : features;
}

function normalizeFeatureSettings(values, motorCount, motors) {
  const settings = {};
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    return settings;
  }
  for (const [key, value] of Object.entries(values)) {
    const toyFunction = normalizeToyFunction(key);
    if (!toyFunction || !value || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    settings[toyFunction] = {
      default: normalizeFeatureDefaultMotors(value.default, motorCount, motors),
      minCount: normalizeMotorMinCount(value.minCount ?? 1, motorCount),
      syncGroup: normalizeMotorSyncGroups(value.syncGroup ?? value.syncGroups ?? [], motorCount),
      workMode: normalizeOptionalWorkMode(value.workMode)
    };
  }
  return settings;
}

function normalizeFeatureDefaultMotors(value, motorCount, motors) {
  if (value === undefined || value === null) {
    return [];
  }
  const selectors = Array.isArray(value) ? value : [value];
  const config = { motorCount, motors };
  const normalizedMotors = new Set();
  for (const selector of selectors) {
    // Feature defaults may use internal motor indexes or public spot aliases.
    normalizedMotors.add(resolveMotorSelector(selector, config));
  }
  return [...normalizedMotors].sort((left, right) => left - right);
}

function normalizeCommandMode(value) {
  return value === ToyCommandMode.queue ? ToyCommandMode.queue : ToyCommandMode.normal;
}

function normalizeBleProtocol(value) {
  const protocol = String(value || ToyBleProtocols.hpbV1).trim();
  if (Object.values(ToyBleProtocols).includes(protocol)) {
    return protocol;
  }
  throw new Error(`Unsupported BLE protocol: ${protocol}`);
}

function getCommandQueueDelay(commands = []) {
  if (!Array.isArray(commands) || !commands.length) {
    return 0;
  }
  return Math.max(0, ...commands.map((command) => Number(command.duration) || 0));
}

function getTimedCommandStopDelay(commands = []) {
  if (!Array.isArray(commands) || !commands.length) {
    return 0;
  }
  return Math.max(0, ...commands.map((command) => Number(command.duration ?? command.durationMs) || 0));
}

function createProtocolStopCommands(toyId, config) {
  const motorCount = normalizeMotorCount(config.motorCount);
  const commands = [];
  for (let motor = 1; motor <= motorCount; motor += 1) {
    const toyFunction = config.motors?.[String(motor)]?.function || ToyFunctions.Vibrate;
    // hpb-v1 uses a fixed 8-byte group. Keep stop frames small and aligned with
    // normal command frames: same motor/function header, zero duration, value 0.
    commands.push({
      toyId,
      value: 0,
      motor,
      duration: 0,
      function: toyFunction,
      forceValueByte: true
    });
  }
  return commands;
}

function normalizeToyFunction(value) {
  if (!value) {
    return null;
  }
  if (Object.values(ToyFunctions).includes(value)) {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  const legacyMap = {
    vibration: ToyFunctions.Vibrate,
    vibrate: ToyFunctions.Vibrate,
    thrusting: ToyFunctions.Oscillate,
    thrust: ToyFunctions.Oscillate,
    stroking: ToyFunctions.Oscillate,
    oscillate: ToyFunctions.Oscillate,
    constrict: ToyFunctions.Constrict,
    squeeze: ToyFunctions.Constrict,
    pump: ToyFunctions.Constrict,
    spray: ToyFunctions.Spray,
    temperature: ToyFunctions.Temperature,
    heating: ToyFunctions.Temperature,
    cooling: ToyFunctions.Temperature,
    discharge: ToyFunctions.Spray,
    rotation: ToyFunctions.Rotate,
    rotate: ToyFunctions.Rotate,
    led: ToyFunctions.Led,
    position: ToyFunctions.Position,
    hwpositionwithduration: ToyFunctions.HwPositionWithDuration,
    adaptive: ToyFunctions.Vibrate
  };
  return legacyMap[normalized] || null;
}

function normalizeMotorMinCount(value, motorCount) {
  const count = Number(value);
  const maxMotorCount = normalizeMotorCount(motorCount);
  if (!Number.isFinite(count)) {
    throw new Error("Vibration motor minimum count must be a number.");
  }
  return Math.max(1, Math.min(maxMotorCount, Math.round(count)));
}

function normalizeMotorCount(value) {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 1 || count > 4) {
    throw new Error("Motor count must be an integer from 1 to 4.");
  }
  return count;
}

function normalizeMotorSyncGroups(groups, motorCount) {
  if (!Array.isArray(groups)) {
    return [];
  }
  const maxMotorCount = normalizeMotorCount(motorCount);
  return groups
    .map((group) => normalizeMotorSyncGroup(group, maxMotorCount))
    .filter((group) => group.length > 1);
}

function normalizeMotorSyncGroup(group, motorCount) {
  if (!Array.isArray(group)) {
    return [];
  }
  const motors = new Set();
  for (const value of group) {
    motors.add(normalizeMotor(value, motorCount));
  }
  return [...motors].sort((left, right) => left - right);
}

function normalizeToyCommand(command, toyId, config) {
  const toyFunction = normalizeToyFunction(command.function ?? ToyFunctions.Vibrate);
  const value = normalizeCommandValue(
    command.value ?? command.vibration ?? command.strength ?? command.vibrationStrength ?? config.vibrationStrengthMin,
    config.vibrationStrengthMin,
    config.vibrationStrengthMax
  );
  const duration = normalizeDuration(command.duration ?? command.durationMs ?? 0);
  return resolveCommandMotors(command, toyFunction, config).map((motor) => ({
    toyId,
    value,
    vibration: value,
    motor,
    duration,
    function: toyFunction,
    workMode: command.workMode,
    featureWorkMode: config.featureSettings?.[toyFunction]?.workMode,
    centerPosition: command.centerPosition ?? command.center ?? command.position,
    amplitude: command.amplitude ?? command.amplitudeStrength,
    speed: command.speed
  }));
}

function normalizeOptionalWorkMode(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  const workMode = Number(value);
  if (!Number.isFinite(workMode)) {
    throw new Error("Feature workMode must be a number.");
  }
  return Math.max(0, Math.min(15, Math.round(workMode)));
}

function normalizePublicCommandList(options = {}) {
  return normalizeCommandList(options).map((command) => {
    const toyFunction = normalizeToyFunction(command.function ?? ToyFunctions.Vibrate);
    const publicCommand = {
      duration: normalizeDuration(command.duration ?? command.durationMs ?? 0),
      function: toyFunction
    };
    if (command.target !== undefined && command.target !== null) {
      publicCommand.target = normalizeStimulusPoint(command.target);
    }
    if (toyFunction === ToyFunctions.Position) {
      publicCommand.centerPosition = Number(command.centerPosition ?? command.center ?? command.position ?? 0);
      publicCommand.amplitude = Number(command.amplitude ?? command.amplitudeStrength ?? 0);
      publicCommand.speed = Number(command.speed ?? 0);
    } else {
      publicCommand.value = Number(command.value ?? command.vibration ?? command.strength ?? command.vibrationStrength ?? 0);
    }
    return publicCommand;
  });
}

function createCommandDebugDetail(command = {}) {
  const toyFunction = normalizeToyFunction(command.function) || ToyFunctions.Vibrate;
  const detail = {
    toyId: command.toyId,
    function: toyFunction,
    value: command.value,
    motor: command.motor,
    duration: command.duration,
    workMode: command.workMode ?? command.featureWorkMode
  };
  if (toyFunction === ToyFunctions.Position) {
    detail.centerPosition = command.centerPosition ?? command.center ?? command.position ?? 50;
    detail.amplitude = command.amplitude ?? command.amplitudeStrength ?? (Number(command.value) > 0 ? command.value : 30);
    detail.speed = command.speed ?? 5;
  }
  return detail;
}

function createUCupFrameDebugDetail(frame) {
  if (!frame || frame[8] !== CMD_U_CUP_CUSTOM || frame[9] !== 0x00 || frame[10] < 0x06) {
    return null;
  }
  return {
    loop: frame[11],
    centerPosition: frame[12],
    amplitude: frame[13],
    speed: frame[14],
    durationUnits: (frame[15] << 8) | frame[16],
    durationMs: ((frame[15] << 8) | frame[16]) * 100
  };
}

function getCharacteristicProperties(properties = {}) {
  return {
    write: Boolean(properties.write),
    writeWithoutResponse: Boolean(properties.writeWithoutResponse),
    notify: Boolean(properties.notify),
    read: Boolean(properties.read)
  };
}

function resolveCommandMotors(command, toyFunction, config) {
  const selector = command.target ?? command.motor;
  if (selector !== undefined && selector !== null) {
    return [resolveMotorSelector(selector, config)];
  }
  const defaultMotors = config.featureSettings?.[toyFunction]?.default;
  if (Array.isArray(defaultMotors) && defaultMotors.length) {
    return defaultMotors;
  }
  const mappedMotors = config.functionMotors?.[toyFunction];
  if (Array.isArray(mappedMotors) && mappedMotors.length) {
    return mappedMotors;
  }
  return [1];
}

function normalizeMotorsConfig(value, fallback = { count: 1 }) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  const count = normalizeMotorCount(source.count ?? fallback.count ?? 1);
  const strength = source.strength && typeof source.strength === "object" ? source.strength : fallback.strength;
  const motors = {
    strength: {
      min: Number(strength?.min ?? 0),
      max: Number(strength?.max ?? 100)
    },
    minCount: normalizeMotorMinCount(source.minCount ?? fallback.minCount ?? 1, count),
    count
  };
  for (let motor = 1; motor <= count; motor += 1) {
    const entry = source[String(motor)] || {};
    motors[String(motor)] = {
      alias: normalizeMotorAliases(entry.alias),
      function: normalizeToyFunction(entry.function ?? entry.functional ?? ToyFunctions.Vibrate)
    };
  }
  return motors;
}

function normalizeMotorAliases(value) {
  const aliases = Array.isArray(value) ? value : value ? [value] : [];
  return aliases
    .map((alias) => String(alias || "").trim())
    .filter(Boolean);
}

function normalizeStimulusPoint(value) {
  const point = String(value || "").trim();
  const normalizedPoint = point.toLowerCase();
  const enumValue = Object.values(Spots).find((item) => item.toLowerCase() === normalizedPoint);
  return enumValue || point;
}

function buildFunctionMotors(motors, motorCount) {
  const result = {};
  for (let motor = 1; motor <= motorCount; motor += 1) {
    const toyFunction = normalizeToyFunction(motors[String(motor)]?.function);
    if (!toyFunction) {
      continue;
    }
    result[toyFunction] = result[toyFunction] || [];
    result[toyFunction].push(motor);
  }
  return result;
}

function resolveMotorSelector(selector, config) {
  const numeric = Number(selector);
  if (Number.isInteger(numeric)) {
    return normalizeMotor(numeric, config.motorCount);
  }
  const normalizedSelector = normalizeStimulusPoint(selector).toLowerCase();
  for (let motor = 1; motor <= config.motorCount; motor += 1) {
    const aliases = config.motors?.[String(motor)]?.alias || [];
    if (aliases.some((alias) => String(alias).trim().toLowerCase() === normalizedSelector)) {
      return motor;
    }
  }
  throw new Error(`Motor target is not configured: ${selector}`);
}

function applyMotorSyncRules(commands, config) {
  const motorCount = normalizeMotorCount(config.motorCount);
  const commandFunction = commands[0]?.function;
  const featureSettings = config.featureSettings?.[commandFunction] || {};
  const minCount = normalizeMotorMinCount(
    featureSettings.minCount ?? config.vibrationMotorMinCount ?? config.motors?.minCount ?? 1,
    motorCount
  );
  const syncGroups = normalizeMotorSyncGroups(
    featureSettings.syncGroup ?? featureSettings.syncGroups ?? config.vibrationMotorSyncGroups ?? [],
    motorCount
  );
  const byMotor = new Map();
  const shouldApplySync = Boolean(commandFunction) && commands.every((command) => command.function === commandFunction);

  if (!shouldApplySync) {
    return commands.sort((left, right) => left.motor - right.motor);
  }

  for (const command of commands) {
    byMotor.set(command.motor, command);
  }
  for (const group of syncGroups) {
    const existing = group.filter((motor) => byMotor.has(motor));
    if (existing.length === 1) {
      const source = byMotor.get(existing[0]);
      for (const motor of group) {
        if (!byMotor.has(motor)) {
          byMotor.set(motor, { ...source, motor });
        }
      }
    }
  }
  if (byMotor.size < minCount) {
    const template = commands[0];
    for (let motor = 1; motor <= motorCount && byMotor.size < minCount; motor += 1) {
      if (!byMotor.has(motor)) {
        byMotor.set(motor, { ...template, motor });
      }
    }
  }
  return [...byMotor.values()].sort((left, right) => left.motor - right.motor);
}

function normalizeCommandValue(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error("Command value must be a number.");
  }
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function normalizeMotor(value, motorCount) {
  const motor = Number(value);
  if (!Number.isInteger(motor) || motor < 1 || motor > motorCount) {
    throw new Error(`Motor must be an integer from 1 to ${motorCount}.`);
  }
  return motor;
}

function normalizeDuration(value) {
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration < 0) {
    throw new Error("Duration must be a non-negative number.");
  }
  return duration;
}

function normalizeCommandList(commands) {
  const commandList = Array.isArray(commands) ? commands : [commands];
  if (commandList.length === 0) {
    throw new Error("At least one command is required.");
  }
  return commandList;
}

function shouldDispatchFeedback(feedback) {
  if (!feedback) {
    return false;
  }
  if (feedback.kind === "response" && (feedback.value === null || feedback.value === undefined)) {
    return false;
  }
  return feedback.kind !== "unknown";
}

function feedAndCollectFrames(buffer, chunk, config = {}) {
  const stx = Number(config.frameStx);
  const flag = Array.isArray(config.frameFlag) ? config.frameFlag : [];
  buffer.push(...chunk);
  const frames = [];
  while (buffer.length) {
    const stxIndex = buffer.indexOf(stx);
    if (stxIndex < 0) {
      buffer.splice(0);
      break;
    }
    if (stxIndex > 0) {
      buffer.splice(0, stxIndex);
    }
    if (buffer.length < 11) {
      break;
    }
    const hasFlag = flag.length === 5 && flag.every((byte, index) => buffer[index + 1] === byte);
    if (!hasFlag) {
      buffer.splice(0, 1);
      continue;
    }
    const dataLength = (buffer[9] << 8) | buffer[10];
    const frameLength = 11 + dataLength + 1 + 2;
    if (buffer.length < frameLength) {
      break;
    }
    frames.push(new Uint8Array(buffer.splice(0, frameLength)));
  }
  return frames;
}

function extractSessionRandom(frame) {
  if (!frame?.payload || frame.payload.length < 18 || frame.responseStatus !== DeviceResponseStatus.success) {
    return null;
  }
  return frame.payload.slice(2, 18);
}

function parseDeviceInfoPayload(payload) {
  if (!payload || payload.length <= 14) {
    return null;
  }
  const statusCode = (payload[0] << 8) | payload[1];
  return {
    responseStatus: statusCode === 0x9000 ? DeviceResponseStatus.success : DeviceResponseStatus.unknown,
    status: payload[13],
    batteryLevel: clampFeedbackValue(Number(payload[14]), { min: 0, max: 100 })
  };
}

function decodeGenericFeedback(frame, feedbackConfig = {}) {
  if (!frame) {
    return null;
  }

  const pressureFeedback = matchFeedbackRule("pressure", frame, feedbackConfig.pressure);
  if (pressureFeedback) {
    return pressureFeedback;
  }

  const batteryFeedback = matchFeedbackRule("battery", frame, feedbackConfig.battery);
  if (batteryFeedback) {
    return batteryFeedback;
  }

  return decodeFrameResponseFeedback(frame);
}

function decodeInlineNotificationFeedback(protocol, frame) {
  if (!frame?.payload || frame.payload.length < 3 || !frame.responseStatus || frame.responseStatus === DeviceResponseStatus.unknown) {
    return null;
  }

  const notification = protocol.parseDeviceNotification(frame.payload);
  if (notification.kind && notification.kind !== "unknown" && !notification.incomplete) {
    return {
      kind: notification.kind,
      value: notification.value,
      unit: notification.unit,
      responseStatus: notification.responseStatus,
      incomplete: false
    };
  }

  // Some Vibrosa Mini pressure reports carry status + type + a two-byte value
  // inside a normal response frame instead of the longer standard notification.
  if (frame.payload[2] === 0x02 && frame.payload.length >= 5) {
    return {
      kind: "pressure",
      value: readUint16Big(frame.payload, 3) / 10,
      unit: "value",
      responseStatus: frame.responseStatus,
      incomplete: false
    };
  }

  return null;
}

function decodeFrameResponseFeedback(frame) {
  if (!frame?.payload || frame.payload.length < 2) {
    return null;
  }
  return frame.responseStatus && frame.responseStatus !== DeviceResponseStatus.unknown
    ? {
      kind: "response",
      responseStatus: frame.responseStatus,
      value: null,
      unit: null
    }
    : null;
}

function matchFeedbackRule(kind, frame, rules = {}) {
  const ruleList = Array.isArray(rules) ? rules : [rules];
  for (const rule of ruleList) {
    const feedback = decodeFeedbackWithRule(kind, frame, rule);
    if (feedback) {
      return feedback;
    }
  }
  return null;
}

function decodeFeedbackWithRule(kind, frame, rule = {}) {
  if (!feedbackRuleMatches(frame, rule)) {
    return null;
  }
  const rawValue = readFeedbackValue(frame.payload, rule);
  if (rawValue === null) {
    return null;
  }
  const scale = Number(rule.scale ?? 1);
  const offset = Number(rule.offset ?? 0);
  return {
    kind,
    value: clampFeedbackValue(rawValue * scale + offset, rule),
    unit: rule.unit || (kind === "battery" ? "percent" : "value")
  };
}

function feedbackRuleMatches(frame, rule = {}) {
  const commands = normalizeCodeList(rule.commands ?? rule.command);
  const responseCodes = normalizeCodeList(rule.responseCodes ?? rule.responseCode);
  const markers = normalizeCodeList(rule.markers ?? rule.marker);
  const markerOffset = Number(rule.markerOffset ?? 0);
  const markerMatches = markers.length
    ? frame.payload?.[markerOffset] !== undefined && markers.includes(toHex(frame.payload[markerOffset]))
    : false;
  const codeMatches = (
    commands.includes(toHex(frame.command)) ||
    (frame.responseCode && responseCodes.includes(frame.responseCode))
  );
  if (markers.length && (commands.length || responseCodes.length)) {
    return codeMatches && markerMatches;
  }
  return markerMatches || codeMatches;
}

function readFeedbackValue(payload, rule = {}) {
  if (!payload?.length) {
    return null;
  }
  const valueLength = Number(rule.valueLength ?? 1);
  const valueOffset = Number(rule.valueOffset ?? 0);
  if (valueOffset < 0 || valueOffset + valueLength > payload.length) {
    return null;
  }
  if (valueLength === 1) {
    return payload[valueOffset];
  }
  if (valueLength === 2) {
    const high = payload[valueOffset];
    const low = payload[valueOffset + 1];
    return rule.endian === "little" ? high | (low << 8) : (high << 8) | low;
  }
  if (valueLength === 4) {
    const b0 = payload[valueOffset];
    const b1 = payload[valueOffset + 1];
    const b2 = payload[valueOffset + 2];
    const b3 = payload[valueOffset + 3];
    return rule.endian === "big"
      ? (((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0)
      : (((b3 << 24) | (b2 << 16) | (b1 << 8) | b0) >>> 0);
  }
  return null;
}

function readUint16Big(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function normalizeCodeList(value) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter((item) => item !== undefined && item !== null && item !== "")
    .map((item) => {
      if (typeof item === "number") {
        return toHex(item & 0xff);
      }
      return String(item).replace(/^0x/i, "").replace(/\s+/g, "").toUpperCase();
    });
}

function clampFeedbackValue(value, rule = {}) {
  let result = value;
  if (Number.isFinite(Number(rule.min))) {
    result = Math.max(Number(rule.min), result);
  }
  if (Number.isFinite(Number(rule.max))) {
    result = Math.min(Number(rule.max), result);
  }
  return result;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function toHex(byte) {
  return byte.toString(16).padStart(2, "0").toUpperCase();
}

const WasmDeviceResponseStatus = Object.freeze({
  0x9000: "success",
  0x6981: "invalidCommand",
  0x6982: "lengthError",
  0x6983: "dataCrcError",
  0x6984: "dataMacError",
  0x6985: "invalidRandom",
  0x6986: "handshakeRequired",
  0x6987: "unsupportedAlgorithm",
  0x6988: "rsaError"
});

const WasmDeviceNotificationType = Object.freeze({
  1: "airPressureParameters",
  2: "pressure",
  3: "depth",
  4: "temperature",
  5: "steps",
  6: "acceleration",
  255: "unknown"
});

const WasmUnitName = Object.freeze({
  0: null,
  1: "value",
  2: "celsius",
  3: "count",
  4: "mg"
});

async function createHoneyPlayBoxProtocolWasm(options = {}) {
  normalizeBleProtocol(options.bleProtocol);
  const wasmUrl = options.wasmUrl || SDK_PROTOCOL_WASM_URL;
  const instance = await instantiateWasm(wasmUrl);
  const api = instance.exports;

  function memoryView() {
    return new Uint8Array(api.memory.buffer);
  }

  function inputPtr() {
    return Number(api.hpb_input_ptr());
  }

  function outputPtr() {
    return Number(api.hpb_output_ptr());
  }

  function readOutput() {
    const start = outputPtr();
    const length = Number(api.hpb_output_len());
    return memoryView().slice(start, start + length);
  }

  function writeInput(bytes, offset = 0) {
    const data = toUint8Array(bytes);
    const ptr = inputPtr() + offset;
    memoryView().set(data, ptr);
    return { ptr, length: data.length };
  }

  function buildByExport(name) {
    const result = Number(api[name]());
    if (result <= 0) {
      throw new Error(`${name} failed.`);
    }
    return readOutput();
  }

  function buildCommandFrame(commands, sessionRandom) {
    const segments = encodeCommands(commands);
    const command = writeInput(segments, 0);
    const random = writeInput(sessionRandom, Math.max(1024, segments.length + 16));
    const result = Number(api.hpb_build_command_frame(command.ptr, command.length, random.ptr, random.length, 0));
    if (result <= 0) {
      throw new Error("Command frame build failed.");
    }
    return readOutput();
  }

  function buildStopFrame(sessionRandom) {
    const random = writeInput(sessionRandom, 1024);
    const result = Number(api.hpb_build_command_frame(inputPtr(), 0, random.ptr, random.length, 1));
    if (result <= 0) {
      throw new Error("Stop frame build failed.");
    }
    return readOutput();
  }

  function buildUCupPositionFrame(commands) {
    const commandList = normalizeCommandList(commands).slice(0, 50);
    const segments = commandList.flatMap((command) => Array.from(buildUCupCustomSegment(command)));
    return buildLocalProtocolFrame(TYPE_DEVICE, CMD_U_CUP_CUSTOM, new Uint8Array([0x00, ...segments]), 0x01);
  }

  function buildUCupStopFrame() {
    return buildLocalProtocolFrame(TYPE_DEVICE, CMD_U_CUP_CUSTOM, new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x01]), 0x01);
  }

  function buildUCupCustomSegment(command) {
    const centerPosition = clampProtocolByte(Number(command.centerPosition ?? command.center ?? command.position ?? 50), 0, 100);
    const fallbackAmplitude = Number(command.value) > 0 ? command.value : 30;
    const amplitude = clampProtocolByte(Number(command.amplitude ?? command.amplitudeStrength ?? fallbackAmplitude), 0, 80);
    const speed = clampProtocolByte(Number(command.speed ?? 5), 0, 10);
    const durationMs = Math.max(0, Number(command.duration ?? command.durationMs ?? 100));
    const durationUnits = Math.min(0xffff, Math.max(1, Math.ceil(durationMs / 100)));
    return new Uint8Array([
      centerPosition,
      amplitude,
      speed,
      (durationUnits >>> 8) & 0xff,
      durationUnits & 0xff
    ]);
  }

  function parseFrame(bytes) {
    const input = writeInput(bytes);
    const result = Number(api.hpb_parse_frame(input.ptr, input.length));
    if (result <= 0) {
      return null;
    }
    const summary = readOutput();
    const payloadOffset = (summary[10] << 8) | summary[11];
    const length = readUint32Big(summary, 6);
    const inputBytes = memoryView();
    const payload = inputBytes.slice(input.ptr + payloadOffset, input.ptr + payloadOffset + length);
    const statusCode = length >= 2 ? ((summary[4] << 8) | summary[5]) : null;
    return {
      counter: summary[0],
      type: summary[1],
      command: summary[2],
      length,
      payload,
      crcOk: summary[3] === 1,
      responseCode: statusCode === null ? null : statusCode.toString(16).padStart(4, "0").toUpperCase(),
      responseStatus: statusCode === null ? null : (WasmDeviceResponseStatus[statusCode] || "unknown")
    };
  }

  function parseDeviceNotification(bytes) {
    const input = writeInput(bytes);
    const result = Number(api.hpb_parse_device_notification(input.ptr, input.length));
    if (result <= 0) {
      return {
        kind: "unknown",
        notificationType: "unknown",
        value: null,
        unit: null,
        responseStatus: "unknown",
        incomplete: true,
        time: Date.now()
      };
    }
    const summary = readOutput();
    const statusCode = (summary[1] << 8) | summary[2];
    const value = new DataView(summary.buffer, summary.byteOffset + 8, 8).getFloat64(0, true);
    const kind = WasmDeviceNotificationType[summary[0]] || "unknown";
    return {
      kind,
      notificationType: kind,
      value: Number.isNaN(value) ? null : value,
      unit: WasmUnitName[summary[4]] ?? null,
      responseStatus: WasmDeviceResponseStatus[statusCode] || "unknown",
      incomplete: summary[3] === 1,
      time: Date.now()
    };
  }

  function readBleConfig() {
    const result = Number(api.hpb_write_ble_config());
    if (result <= 0) {
      throw new Error("BLE config read failed.");
    }
    const decoder = new TextDecoder();
    const parts = decoder.decode(readOutput()).split("\0").filter(Boolean);
    return {
      serviceUuid: parts[0],
      writeCharacteristic: parts[1],
      readCharacteristic: parts[2],
      batteryServiceUuid: parts[3],
      batteryLevelUuid: parts[4]
    };
  }

  const isUCupProtocol = options.bleProtocol === ToyBleProtocols.hpbU;
  return Object.freeze({
    bleConfig: Object.freeze(readBleConfig()),
    frameStx: Number(api.hpb_frame_stx()),
    frameFlag: Object.freeze(Array.from({ length: 5 }, (_, index) => Number(api.hpb_frame_flag_byte(index)))),
    requiresSession: !isUCupProtocol,
    buildHandshakeFrame: () => buildByExport("hpb_build_handshake_frame"),
    buildRandomRequestFrame: () => buildByExport("hpb_build_random_request_frame"),
    buildDeviceInfoRequestFrame: () => buildByExport("hpb_build_device_info_request_frame"),
    // U-type cup devices use a compact position/gear command. Keep this branch
    // outside the hpb-v1 WASM command builder because the payload layout differs.
    buildCommandFrame: isUCupProtocol ? buildUCupPositionFrame : buildCommandFrame,
    buildStopFrame: isUCupProtocol ? buildUCupStopFrame : buildStopFrame,
    preferWriteWithoutResponse: isUCupProtocol,
    rawCommandWrite: isUCupProtocol,
    parseFrame,
    parseDeviceNotification
  });
}

async function instantiateWasm(wasmUrl) {
  const imports = {
    env: {
      abort() {
        throw new Error("HoneyPlayBox protocol wasm aborted.");
      }
    }
  };
  if (typeof WebAssembly.instantiateStreaming === "function") {
    try {
      const result = await WebAssembly.instantiateStreaming(fetch(wasmUrl), imports);
      return result.instance;
    } catch {
      // Some local servers do not serve application/wasm. Fall back to bytes.
    }
  }
  const response = await fetch(wasmUrl);
  const bytes = await response.arrayBuffer();
  const result = await WebAssembly.instantiate(bytes, imports);
  return result.instance;
}

function encodeCommands(commands) {
  const list = Array.isArray(commands) ? commands : [commands];
  if (list.length === 0) {
    throw new Error("At least one command is required.");
  }
  const encodedCommands = list.flatMap((command) => expandEncodedProtocolCommand(command));
  const bytes = new Uint8Array(encodedCommands.length * 8);
  encodedCommands.forEach((command, index) => {
    const offset = index * 8;
    const maxCommandValue = command.forceValueByte ? 255 : 100;
    const vibration = clampProtocolByte(
      command.value ?? command.vibration ?? command.strength ?? command.vibrationStrength ?? 0,
      0,
      maxCommandValue
    );
    const motor = clampProtocolByte(command.motor ?? 1, 1, 4);
    const durationMs = Math.max(0, Number(command.duration ?? command.durationMs ?? 0));
    const durationUnits = Math.min(0xffff, Math.ceil(durationMs / 100));
    bytes[offset] = resolveCommandModeAndType(command, motor);
    bytes[offset + 1] = 0x00;
    bytes[offset + 2] = 0x05;
    bytes[offset + 3] = (durationUnits >>> 8) & 0xff;
    bytes[offset + 4] = durationUnits & 0xff;
    bytes[offset + 5] = 0x00;
    bytes[offset + 6] = 0x00;
    bytes[offset + 7] = resolveCommandValueByte(command, motor, vibration);
  });
  return bytes;
}

function buildProtocolCommandFrames(protocol, commands, sessionRandom) {
  return [protocol.buildCommandFrame(commands, sessionRandom)];
}

function groupProtocolCommandsByMode(commands) {
  const list = Array.isArray(commands) ? commands : [commands];
  const groups = [];
  for (const command of list) {
    const motor = clampProtocolByte(command.motor ?? 1, 1, 4);
    const modeAndType = resolveCommandModeAndType(command, motor);
    let group = groups.find((item) => item.modeAndType === modeAndType);
    if (!group) {
      group = { modeAndType, commands: [] };
      groups.push(group);
    }
    group.commands.push(command);
  }
  return groups.map((group) => group.commands);
}

function expandEncodedProtocolCommand(command) {
  if (!isTimedConstrictCommand(command)) {
    return [command];
  }
  // Constrict needs an explicit timed segment before the actuator segment;
  // the actuator segment keeps the function-specific value byte.
  return [
    { ...command, forceValueByte: true },
    { ...command, duration: 0, durationMs: 0 }
  ];
}

function isTimedConstrictCommand(command) {
  const toyFunction = normalizeToyFunction(command.function) || ToyFunctions.Vibrate;
  const durationMs = Math.max(0, Number(command.duration ?? command.durationMs ?? 0));
  return toyFunction === ToyFunctions.Constrict && durationMs > 0;
}

function toUint8Array(input) {
  if (input instanceof Uint8Array) {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  return new Uint8Array(input);
}

function buildLocalProtocolFrame(type, command, data = new Uint8Array(), counter = nextLocalFrameCounter()) {
  const length = data.length;
  const body = new Uint8Array([type, command, (length >> 8) & 0xff, length & 0xff, ...data]);
  const crc = crc16Modbus(body);
  return new Uint8Array([
    HPB_FRAME_STX,
    ...HPB_FRAME_FLAG,
    counter,
    ...body,
    HPB_FRAME_ETX,
    (crc >> 8) & 0xff,
    crc & 0xff
  ]);
}

function nextLocalFrameCounter() {
  hpbFrameCounter = (hpbFrameCounter + 1) & 0xff;
  return hpbFrameCounter;
}

function crc16Modbus(bytes) {
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? ((crc >>> 1) ^ 0xa001) : (crc >>> 1);
    }
  }
  return crc & 0xffff;
}

function clampProtocolByte(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error("Byte value must be a number.");
  }
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function resolveCommandWorkMode(command = {}) {
  if (command.workMode !== undefined && command.workMode !== null) {
    return command.workMode;
  }
  const toyFunction = normalizeToyFunction(command.function) || ToyFunctions.Vibrate;
  const featureWorkMode = command.featureWorkMode;
  if (featureWorkMode !== undefined && featureWorkMode !== null) {
    return featureWorkMode;
  }
  return TOY_FUNCTION_WORK_MODES[toyFunction] ?? TOY_FUNCTION_WORK_MODES[ToyFunctions.Vibrate];
}

function resolveCommandModeAndType(command = {}, motor = 1) {
  const normalizedMotor = clampProtocolByte(motor, 1, 4);
  const workMode = clampProtocolByte(resolveCommandWorkMode(command), 0, 15);
  return (((normalizedMotor - 1) & 0x0f) << 4) | (workMode & 0x0f);
}

function resolveCommandValueByte(command = {}, motor = 1, fallbackValue = 0) {
  if (command.forceValueByte) {
    return fallbackValue;
  }
  const toyFunction = normalizeToyFunction(command.function) || ToyFunctions.Vibrate;
  if (toyFunction === ToyFunctions.Constrict) {
    // Bluetooth command protocol: Constrict writes decimal 101-104 at the
    // 12th byte from the end of the full transport frame for motors 1-4.
    return 100 + clampProtocolByte(motor, 1, 4);
  }
  return fallbackValue;
}

function readUint32Big(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

if (globalThis.window) {
  const root = window.HoneyPlayBox || {};
  root.SDK = {
    ...root.SDK,
    Toy,
    ToyConnector,
    ToyFunctions,
    ToyCommandMode,
    Spots,
    DeviceNotificationType,
    DeviceResponseStatus,
    createToyConnector,
    isBleSupported
  };
  window.HoneyPlayBox = root;
}

