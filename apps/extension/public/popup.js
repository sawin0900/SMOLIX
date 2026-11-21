const apiUrls = [
    "https://jetsale.online/api",
    "http://127.0.0.1:3001",
    "http://localhost:3001",
  ];

const API_URL = apiUrls[0];

const loginSection = document.getElementById("loginSection");
const accountSection = document.getElementById("accountSection");
const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");
const appMessage = document.getElementById("appMessage");
const statusText = document.getElementById("statusText");
const statusDot = document.getElementById("statusDot");
const connectButton = document.getElementById("connectButton");
const connectButtonText = document.getElementById("connectButtonText");
const connectionLabel = document.getElementById("connectionLabel");
const latencyValue = document.getElementById("latency");
const durationValue = document.getElementById("duration");

const PROXY_STARTED_AT_KEY = "smolixProxyStartedAt";

let isProxyConnected = false;
let sessionTimer = null;
let latencyTimer = null;
let sessionStartedAt = null;

const serverPicker = document.getElementById("serverPicker");
const serverList = document.getElementById("serverList");
const closeServerPicker = document.getElementById("closeServerPicker");

let availableServers = [];
let selectedServer = null;
let proxyMode = "youtube";

const youtubeModeButton = document.getElementById("youtubeMode");
const fullModeButton = document.getElementById("fullMode");

const mainScreen = document.getElementById("mainScreen");
const settingsScreen = document.getElementById("settingsScreen");
const premiumModal = document.getElementById("premiumModal");
const openSettings = document.getElementById("openSettings");
const closeSettings = document.getElementById("closeSettings");
const closeSettingsIcon = document.getElementById("closeSettingsIcon");
const backSettings = document.getElementById("backSettings");
const premiumCard = document.getElementById("premiumCard");
const closePremium = document.getElementById("closePremium");
const closePremiumBottom = document.getElementById("closePremiumBottom");


function formatSessionDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0")
  ].join(":");
}

function stopSessionTimer() {
  if (sessionTimer) {
    clearInterval(sessionTimer);
    sessionTimer = null;
  }

  durationValue.textContent = "00:00:00";
}

function startSessionTimer(startedAt) {
  stopSessionTimer();

  sessionStartedAt = startedAt || Date.now();

  const update = () => {
    durationValue.textContent = formatSessionDuration(
      Date.now() - sessionStartedAt
    );
  };

  update();
  sessionTimer = setInterval(update, 1000);
}

function renderConnectionState(connected) {
  isProxyConnected = connected;

  connectButtonText.textContent = connected
    ? "Отключить"
    : "Подключить";

  connectionLabel.textContent = connected
    ? "Подключено"
    : "Не подключено";

  setStatus(
    connected,
    connected ? "Прокси подключён" : "Прокси отключён"
  );

  if (!connected) {
    stopSessionTimer();
    latencyValue.textContent = "—";
  }
}

async function checkLatency() {
  if (!isProxyConnected) return;

  const started = performance.now();

  try {
    await fetch(
      `https://www.cloudflare.com/cdn-cgi/trace?smolix=${Date.now()}`,
      {
        method: "GET",
        cache: "no-store",
        mode: "no-cors",
        signal: AbortSignal.timeout(10000)
      }
    );

    if (!isProxyConnected) return;

    const elapsed = Math.round(performance.now() - started);
    latencyValue.textContent = `${elapsed} мс`;
  } catch (error) {
    console.error("jetsale.online latency check error:", error);

    if (isProxyConnected) {
      latencyValue.textContent = "—";
    }
  }
}

function startLatencyMonitoring() {
  stopLatencyMonitoring();

  checkLatency();

  latencyTimer = setInterval(() => {
    checkLatency();
  }, 30000);
}

function stopLatencyMonitoring() {
  if (latencyTimer) {
    clearInterval(latencyTimer);
    latencyTimer = null;
  }
}

async function restoreConnectionState() {
  const storageMode = await chrome.storage.session.get("smolixProxyMode");
  setProxyMode(storageMode.smolixProxyMode === "full" ? "full" : "youtube");

  try {
    const result = await chrome.runtime.sendMessage({
      type: "GET_PROXY_STATUS"
    });

    const storage = await chrome.storage.session.get([
      "smolixProxyCredentials",
      PROXY_STARTED_AT_KEY
    ]);

    const proxy = result?.value?.rules?.singleProxy;

    const isFullProxy =
      result.value?.mode === "fixed_servers" &&
      proxy?.host === "rassiya.jetsale.online" &&
      proxy?.port === 8443;

    const isYoutubeProxy =
      result.value?.mode === "pac_script" &&
      typeof result.value?.pacScript?.data === "string" &&
      result.value.pacScript.data.includes("googlevideo.com");

    const connected =
      result?.success === true &&
      Boolean(storage.smolixProxyCredentials) &&
      (isFullProxy || isYoutubeProxy);

    if (connected) {
      renderConnectionState(true);
      startSessionTimer(storage[PROXY_STARTED_AT_KEY]);
      checkLatency();
      startLatencyMonitoring();
    } else {
      renderConnectionState(false);
      stopLatencyMonitoring();
    }
  } catch (error) {
    console.error("jetsale.online status restore error:", error);
    renderConnectionState(false);
  }
}


function showMessage(element, message) {
  element.textContent = message || "";
}

function setStatus(online, message) {
  statusText.textContent = message;
  statusDot.classList.toggle("online", online);
}

async function getToken() {
  const result = await chrome.storage.local.get("smolixToken");
  return result.smolixToken || null;
}

async function apiRequest(path, options = {}, token = null) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  let lastNetworkError;

  for (const baseUrl of apiUrls) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await fetch(`${baseUrl}${path}`, {
          ...options,
          headers,
          signal: AbortSignal.timeout(8000),
        });
        break;
      } catch (error) {
        lastNetworkError = error;
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }
    }

    if (response) break;
  }

  if (!response) {
    throw lastNetworkError || new Error("API недоступен");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Ошибка сервера: ${response.status}`);
  }

  return data;
}

function showLogin(message = "") {
  loginSection.hidden = false;
  accountSection.hidden = true;

  setStatus(false, "Не авторизован");
  showMessage(loginMessage, message);
}

function renderSelectedServer() {
  const serverName = document.getElementById("serverName");
  const serverDescription = document.getElementById("serverDescription");

  if (!selectedServer) {
    serverName.textContent = availableServers.length
      ? "Выберите сервер"
      : "Нет доступных серверов";
    serverDescription.textContent = availableServers.length
      ? "Выберите подходящую локацию"
      : "Серверы появятся после настройки";
    return;
  }

  serverName.textContent = selectedServer.name;
  serverDescription.textContent = [
    selectedServer.city,
    selectedServer.country,
  ].filter(Boolean).join(", ");
}

async function loadServers(token) {
  try {
    const data = await apiRequest(`/extension/servers?mode=${encodeURIComponent(proxyMode)}`, {}, token);
    availableServers = Array.isArray(data.servers) ? data.servers : [];

    const saved = await chrome.storage.local.get("smolixSelectedServerId");
    const savedId = saved.smolixSelectedServerId;

    selectedServer =
      availableServers.find(server => server.id === savedId) ||
      availableServers[0] ||
      null;

    if (selectedServer) {
      await chrome.storage.local.set({
        smolixSelectedServerId: selectedServer.id,
      });
    }

    renderSelectedServer();
  } catch (error) {
    availableServers = [];
    selectedServer = null;
    renderSelectedServer();
    serverList.textContent = error.message;
  }
}

function renderServerList() {
  serverList.replaceChildren();

  if (!availableServers.length) {
    const empty = document.createElement("div");
    empty.className = "message";
    empty.textContent = "Нет доступных серверов";
    serverList.appendChild(empty);
    return;
  }

  availableServers.forEach(server => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "server-option";

    if (selectedServer?.id === server.id) {
      button.classList.add("selected");
    }

    const flag = document.createElement("span");
    flag.className = "server-flag";
    flag.textContent = server.country === "Россия" ? "🇷🇺" : "🌐";

    const details = document.createElement("span");
    details.className = "server-details";

    const name = document.createElement("strong");
    name.textContent = server.name;

    const description = document.createElement("span");
    description.textContent = [
      server.city,
      server.country,
    ].filter(Boolean).join(", ");

    details.append(name, description);

    const check = document.createElement("span");
    check.className = "server-check";
    check.textContent = selectedServer?.id === server.id ? "✓" : "";

    button.append(flag, details, check);

    button.addEventListener("click", async () => {
      selectedServer = server;

      await chrome.storage.local.set({
        smolixSelectedServerId: server.id,
      });

      renderSelectedServer();
      showMessage(appMessage, `Выбрана локация: ${server.name}`);
    });

    serverList.appendChild(button);
  });
}

async function checkSession() {
  const token = await getToken();

  if (!token) {
    showLogin();
    return;
  }

  try {
    const data = await apiRequest("/extension/me", {}, token);

    loginSection.hidden = true;
    accountSection.hidden = false;

    document.getElementById("userEmail").textContent = data.user.email;
    document.getElementById("settingsEmail").textContent = data.user.email;

    const premiumTitle = document.getElementById("premiumTitle");
    const premiumBadge = document.getElementById("premiumBadge");
    const premiumAction = document.getElementById("premiumAction");

    if (data.subscription?.status === "ACTIVE" && !data.subscription.isTrial) {
      premiumTitle.textContent = "У вас есть Premium";
      premiumBadge.textContent = "Premium";
      premiumAction.textContent = "Управление подпиской";
    } else {
      premiumTitle.textContent = "У вас нет Premium";
      premiumBadge.textContent = data.subscription?.isTrial ? "Trial" : "Free";
      premiumAction.textContent = data.subscription?.isTrial
        ? "Посмотреть преимущества"
        : "Попробовать бесплатно";
    }

    setStatus(false, "Аккаунт активен");
    showMessage(appMessage, "");

    await loadServers(token);
    await restoreConnectionState();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось проверить сессию";

    if (/сесси|авториза|401|403/i.test(message)) {
      await chrome.storage.local.remove("smolixToken");
      showLogin("Сессия завершена. Войдите снова.");
      return;
    }

    showLogin("API недоступен. Проверьте подключение и запустите jetsale.online API.");
  }
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  loginButton.disabled = true;
  loginButton.textContent = "Выполняется вход...";
  showMessage(loginMessage, "");

  try {
    const data = await apiRequest("/extension/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        deviceName: "jetsale.online Chrome Extension",
      }),
    });

    await chrome.storage.local.set({
      smolixToken: data.token,
    });

    document.getElementById("password").value = "";
    await checkSession();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось войти";

    showMessage(
      loginMessage,
      /Failed to fetch|NetworkError|fetch/i.test(message)
        ? "Не удалось подключиться к API. Проверьте запуск сервера на порту 3001."
        : message
    );
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Войти в jetsale.online";
  }
});


document.getElementById("logoutButton").addEventListener("click", async () => {
  const token = await getToken();

  try {
    await chrome.runtime.sendMessage({
      type: "DISCONNECT"
    });
  } catch (error) {
    console.error("jetsale.online proxy disconnect error:", error);
  }

  try {
    if (token) {
      await apiRequest("/extension/logout", {
        method: "POST",
        body: JSON.stringify({}),
      }, token);
    }
  } catch (error) {
    console.error("jetsale.online logout error:", error);
  } finally {
    await chrome.storage.session.remove("smolixProxyCredentials");

    await chrome.storage.local.remove([
      "smolixToken",
      "smolixSelectedServerId",
    ]);

    selectedServer = null;
    availableServers = [];

    setStatus(false, "Не авторизован");
    showLogin("Вы вышли из аккаунта.");
  }
});

document.getElementById("connectButton").addEventListener("click", async () => {
  connectButton.disabled = true;
  showMessage(appMessage, "");

  try {
    if (isProxyConnected) {
      const result = await chrome.runtime.sendMessage({
        type: "DISCONNECT"
      });

      if (!result?.success) {
        throw new Error(result?.message || "Не удалось отключить прокси");
      }

      renderConnectionState(false);
      stopLatencyMonitoring();

      showMessage(appMessage, "Соединение отключено");
    } else {
      const result = await chrome.runtime.sendMessage({
        type: "CONNECT",
        serverId: selectedServer?.id || null,
        mode: proxyMode
      });

      if (!result?.success) {
        throw new Error(result?.message || "Не удалось подключиться");
      }

      const storage = await chrome.storage.session.get(
        PROXY_STARTED_AT_KEY
      );

      renderConnectionState(true);
      startSessionTimer(
        result.startedAt || storage[PROXY_STARTED_AT_KEY]
      );
      startLatencyMonitoring();

      showMessage(appMessage, "Прокси подключён");
    }
  } catch (error) {
    console.error("jetsale.online connection error:", error);
    showMessage(appMessage, error.message || "Ошибка подключения");
  } finally {
    connectButton.disabled = false;
  }
});

checkSession();

function setProxyMode(mode) {
  proxyMode = mode;
  youtubeModeButton.classList.toggle("active", mode === "youtube");
  fullModeButton.classList.toggle("active", mode === "full");


  showMessage(appMessage, "");
}

youtubeModeButton.addEventListener("click", () => setProxyMode("youtube"));
fullModeButton.addEventListener("click", () => setProxyMode("full"));

function showSettings() {
  mainScreen.hidden = true;
  settingsScreen.hidden = false;
}

function hideSettings() {
  settingsScreen.hidden = true;
  mainScreen.hidden = false;
}

function showPremium() {
  premiumModal.hidden = false;
}

function hidePremium() {
  premiumModal.hidden = true;
}

openSettings?.addEventListener("click", showSettings);
closeSettings?.addEventListener("click", hideSettings);
closeSettingsIcon?.addEventListener("click", hideSettings);
backSettings?.addEventListener("click", hideSettings);
premiumCard?.addEventListener("click", showPremium);
closePremium?.addEventListener("click", hidePremium);
closePremiumBottom?.addEventListener("click", hidePremium);