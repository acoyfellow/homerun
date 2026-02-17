// node_modules/electrobun/dist/api/shared/rpc.ts
var MAX_ID = 10000000000;
var DEFAULT_MAX_REQUEST_TIME = 1000;
function missingTransportMethodError(methods, action) {
  const methodsString = methods.map((m) => `"${m}"`).join(", ");
  return new Error(`This RPC instance cannot ${action} because the transport did not provide one or more of these methods: ${methodsString}`);
}
function createRPC(options = {}) {
  let debugHooks = {};
  let transport = {};
  let requestHandler = undefined;
  function setTransport(newTransport) {
    if (transport.unregisterHandler)
      transport.unregisterHandler();
    transport = newTransport;
    transport.registerHandler?.(handler);
  }
  function setRequestHandler(h) {
    if (typeof h === "function") {
      requestHandler = h;
      return;
    }
    requestHandler = (method, params) => {
      const handlerFn = h[method];
      if (handlerFn)
        return handlerFn(params);
      const fallbackHandler = h._;
      if (!fallbackHandler)
        throw new Error(`The requested method has no handler: ${String(method)}`);
      return fallbackHandler(method, params);
    };
  }
  const { maxRequestTime = DEFAULT_MAX_REQUEST_TIME } = options;
  if (options.transport)
    setTransport(options.transport);
  if (options.requestHandler)
    setRequestHandler(options.requestHandler);
  if (options._debugHooks)
    debugHooks = options._debugHooks;
  let lastRequestId = 0;
  function getRequestId() {
    if (lastRequestId <= MAX_ID)
      return ++lastRequestId;
    return lastRequestId = 0;
  }
  const requestListeners = new Map;
  const requestTimeouts = new Map;
  function requestFn(method, ...args) {
    const params = args[0];
    return new Promise((resolve, reject) => {
      if (!transport.send)
        throw missingTransportMethodError(["send"], "make requests");
      const requestId = getRequestId();
      const request2 = {
        type: "request",
        id: requestId,
        method,
        params
      };
      requestListeners.set(requestId, { resolve, reject });
      if (maxRequestTime !== Infinity)
        requestTimeouts.set(requestId, setTimeout(() => {
          requestTimeouts.delete(requestId);
          reject(new Error("RPC request timed out."));
        }, maxRequestTime));
      debugHooks.onSend?.(request2);
      transport.send(request2);
    });
  }
  const request = new Proxy(requestFn, {
    get: (target, prop, receiver) => {
      if (prop in target)
        return Reflect.get(target, prop, receiver);
      return (params) => requestFn(prop, params);
    }
  });
  const requestProxy = request;
  function sendFn(message, ...args) {
    const payload = args[0];
    if (!transport.send)
      throw missingTransportMethodError(["send"], "send messages");
    const rpcMessage = {
      type: "message",
      id: message,
      payload
    };
    debugHooks.onSend?.(rpcMessage);
    transport.send(rpcMessage);
  }
  const send = new Proxy(sendFn, {
    get: (target, prop, receiver) => {
      if (prop in target)
        return Reflect.get(target, prop, receiver);
      return (payload) => sendFn(prop, payload);
    }
  });
  const sendProxy = send;
  const messageListeners = new Map;
  const wildcardMessageListeners = new Set;
  function addMessageListener(message, listener) {
    if (!transport.registerHandler)
      throw missingTransportMethodError(["registerHandler"], "register message listeners");
    if (message === "*") {
      wildcardMessageListeners.add(listener);
      return;
    }
    if (!messageListeners.has(message))
      messageListeners.set(message, new Set);
    messageListeners.get(message).add(listener);
  }
  function removeMessageListener(message, listener) {
    if (message === "*") {
      wildcardMessageListeners.delete(listener);
      return;
    }
    messageListeners.get(message)?.delete(listener);
    if (messageListeners.get(message)?.size === 0)
      messageListeners.delete(message);
  }
  async function handler(message) {
    debugHooks.onReceive?.(message);
    if (!("type" in message))
      throw new Error("Message does not contain a type.");
    if (message.type === "request") {
      if (!transport.send || !requestHandler)
        throw missingTransportMethodError(["send", "requestHandler"], "handle requests");
      const { id, method, params } = message;
      let response;
      try {
        response = {
          type: "response",
          id,
          success: true,
          payload: await requestHandler(method, params)
        };
      } catch (error) {
        if (!(error instanceof Error))
          throw error;
        response = {
          type: "response",
          id,
          success: false,
          error: error.message
        };
      }
      debugHooks.onSend?.(response);
      transport.send(response);
      return;
    }
    if (message.type === "response") {
      const timeout = requestTimeouts.get(message.id);
      if (timeout != null)
        clearTimeout(timeout);
      const { resolve, reject } = requestListeners.get(message.id) ?? {};
      if (!message.success)
        reject?.(new Error(message.error));
      else
        resolve?.(message.payload);
      return;
    }
    if (message.type === "message") {
      for (const listener of wildcardMessageListeners)
        listener(message.id, message.payload);
      const listeners = messageListeners.get(message.id);
      if (!listeners)
        return;
      for (const listener of listeners)
        listener(message.payload);
      return;
    }
    throw new Error(`Unexpected RPC message type: ${message.type}`);
  }
  const proxy = { send: sendProxy, request: requestProxy };
  return {
    setTransport,
    setRequestHandler,
    request,
    requestProxy,
    send,
    sendProxy,
    addMessageListener,
    removeMessageListener,
    proxy
  };
}
function defineElectrobunRPC(_side, config) {
  const rpcOptions = {
    maxRequestTime: config.maxRequestTime,
    requestHandler: {
      ...config.handlers.requests,
      ...config.extraRequestHandlers
    },
    transport: {
      registerHandler: () => {}
    }
  };
  const rpc = createRPC(rpcOptions);
  const messageHandlers = config.handlers.messages;
  if (messageHandlers) {
    rpc.addMessageListener("*", (messageName, payload) => {
      const globalHandler = messageHandlers["*"];
      if (globalHandler) {
        globalHandler(messageName, payload);
      }
      const messageHandler = messageHandlers[messageName];
      if (messageHandler) {
        messageHandler(payload);
      }
    });
  }
  return rpc;
}

// node_modules/electrobun/dist/api/browser/index.ts
var WEBVIEW_ID = window.__electrobunWebviewId;
var RPC_SOCKET_PORT = window.__electrobunRpcSocketPort;

class Electroview {
  bunSocket;
  rpc;
  rpcHandler;
  constructor(config) {
    this.rpc = config.rpc;
    this.init();
  }
  init() {
    this.initSocketToBun();
    window.__electrobun.receiveMessageFromBun = this.receiveMessageFromBun.bind(this);
    if (this.rpc) {
      this.rpc.setTransport(this.createTransport());
    }
  }
  initSocketToBun() {
    const socket = new WebSocket(`ws://localhost:${RPC_SOCKET_PORT}/socket?webviewId=${WEBVIEW_ID}`);
    this.bunSocket = socket;
    socket.addEventListener("open", () => {});
    socket.addEventListener("message", async (event) => {
      const message = event.data;
      if (typeof message === "string") {
        try {
          const encryptedPacket = JSON.parse(message);
          const decrypted = await window.__electrobun_decrypt(encryptedPacket.encryptedData, encryptedPacket.iv, encryptedPacket.tag);
          this.rpcHandler?.(JSON.parse(decrypted));
        } catch (err) {
          console.error("Error parsing bun message:", err);
        }
      } else if (message instanceof Blob) {} else {
        console.error("UNKNOWN DATA TYPE RECEIVED:", event.data);
      }
    });
    socket.addEventListener("error", (event) => {
      console.error("Socket error:", event);
    });
    socket.addEventListener("close", (_event) => {});
  }
  createTransport() {
    const that = this;
    return {
      send(message) {
        try {
          const messageString = JSON.stringify(message);
          that.bunBridge(messageString);
        } catch (error) {
          console.error("bun: failed to serialize message to webview", error);
        }
      },
      registerHandler(handler) {
        that.rpcHandler = handler;
      }
    };
  }
  async bunBridge(msg) {
    if (this.bunSocket?.readyState === WebSocket.OPEN) {
      try {
        const { encryptedData, iv, tag } = await window.__electrobun_encrypt(msg);
        const encryptedPacket = {
          encryptedData,
          iv,
          tag
        };
        const encryptedPacketString = JSON.stringify(encryptedPacket);
        this.bunSocket.send(encryptedPacketString);
        return;
      } catch (error) {
        console.error("Error sending message to bun via socket:", error);
      }
    }
    window.__electrobunBunBridge?.postMessage(msg);
  }
  receiveMessageFromBun(msg) {
    if (this.rpcHandler) {
      this.rpcHandler(msg);
    }
  }
  static defineRPC(config) {
    return defineElectrobunRPC("webview", {
      ...config,
      extraRequestHandlers: {
        evaluateJavascriptWithResponse: ({ script }) => {
          return new Promise((resolve) => {
            try {
              const resultFunction = new Function(script);
              const result = resultFunction();
              if (result instanceof Promise) {
                result.then((resolvedResult) => {
                  resolve(resolvedResult);
                }).catch((error) => {
                  console.error("bun: async script execution failed", error);
                  resolve(String(error));
                });
              } else {
                resolve(result);
              }
            } catch (error) {
              console.error("bun: failed to eval script", error);
              resolve(String(error));
            }
          });
        }
      }
    });
  }
}

// src/views/dashboard/index.ts
var rpc = Electroview.defineRPC({
  maxRequestTime: 1e4,
  handlers: {
    requests: {},
    messages: {
      proxyStatusChanged: (status) => {
        updateStatusUI(status.running, status.port, status.requestCount);
      },
      trafficEntry: (exchange) => {
        appendTrafficEntry(exchange.request.method, exchange.request.url, exchange.response.status);
      },
      sessionUpdated: () => {}
    }
  }
});
var _electrobun = new Electroview({ rpc });
var toggleBtn = document.getElementById("toggle-proxy");
var statusBadge = document.getElementById("proxy-status");
var portDisplay = document.getElementById("port-display");
var requestCountEl = document.getElementById("request-count");
var entriesEl = document.getElementById("entries");
var proxyRunning = false;
toggleBtn.addEventListener("click", async () => {
  if (proxyRunning) {
    await rpc.request.stopProxy({});
    proxyRunning = false;
  } else {
    const status = await rpc.request.startProxy({});
    proxyRunning = true;
    updateStatusUI(status.running, status.port, status.requestCount);
  }
  updateToggleButton();
});
async function init() {
  const status = await rpc.request.getProxyStatus({});
  proxyRunning = status.running;
  updateStatusUI(status.running, status.port, status.requestCount);
  updateToggleButton();
}
function updateStatusUI(running, port, requests) {
  statusBadge.textContent = running ? "Running" : "Stopped";
  statusBadge.className = `status-badge ${running ? "running" : "stopped"}`;
  portDisplay.textContent = `Port: ${port}`;
  requestCountEl.textContent = `Requests: ${requests}`;
}
function updateToggleButton() {
  toggleBtn.textContent = proxyRunning ? "Stop Proxy" : "Start Proxy";
}
function appendTrafficEntry(method, url, status) {
  const entry = document.createElement("div");
  entry.className = "traffic-entry";
  entry.innerHTML = `<span class="method">${method}</span> <span class="url">${url}</span> <span class="status status-${Math.floor(status / 100)}xx">${status}</span>`;
  entriesEl.prepend(entry);
}
init();
