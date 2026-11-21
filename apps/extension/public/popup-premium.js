const API_URLS = ["http://127.0.0.1:3001", "http://localhost:3001"];
const $ = (id) => document.getElementById(id);

const screens = {
  onboarding: $("onboardingScreen"),
  auth: $("authScreen"),
  recovery: $("recoveryScreen"),
  main: $("mainScreen"),
  settings: $("settingsScreen"),
  password: $("passwordScreen"),
  history: $("historyScreen"),
  servers: $("serversScreen"),
  devices: $("devicesScreen"),
};

const ONBOARD_SEEN_KEY = "smolixOnboardSeen";
const FIRST_TIP_KEY = "smolixFirstConnectTipDismissed";

const COUNTRY_FLAGS = {
  Россия: "🇷🇺",
  Russia: "🇷🇺",
  Германия: "🇩🇪",
  Germany: "🇩🇪",
  Нидерланды: "🇳🇱",
  Netherlands: "🇳🇱",
  США: "🇺🇸",
  USA: "🇺🇸",
  "United States": "🇺🇸",
  Финляндия: "🇫🇮",
  Finland: "🇫🇮",
  Турция: "🇹🇷",
  Turkey: "🇹🇷",
  Казахстан: "🇰🇿",
  Kazakhstan: "🇰🇿",
};

let authMode = "login";
let authFormStartedAt = Date.now();
let proxyMode = "youtube";
let isConnected = false;
let apiOffline = false;
let selectedServer = null;
let sessionTimer = null;
let latencyTimer = null;
let startedAt = null;

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, el]) => {
    if (el) el.hidden = key !== name;
  });
}

function showToast(message, type = "info") {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.remove("success", "error");
  if (type === "success" || type === "error") el.classList.add(type);
  el.hidden = false;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => {
    el.hidden = true;
  }, 2600);
}

function isNetworkError(error) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /Failed to fetch|NetworkError|fetch|API недоступен|AbortError|timeout|Timed out/i.test(message);
}

function setOfflineBanner(visible, message) {
  const banner = $("offlineBanner");
  if (!banner) return;
  banner.hidden = !visible;
  if (message) setText("offlineBannerText", message);
}

function setAuthProxyBanner(visible) {
  const banner = $("authProxyBanner");
  if (banner) banner.hidden = !visible;
}

function isSmolixProxyConfig(value) {
  const proxy = value?.rules?.singleProxy;
  const full =
    value?.mode === "fixed_servers" &&
    proxy?.host === "rassiya.jetsale.online" &&
    proxy?.port === 8443;
  const youtube =
    value?.mode === "pac_script" &&
    value?.pacScript?.data?.includes("googlevideo.com");
  return Boolean(full || youtube);
}

async function hasActiveProxy() {
  try {
    const result = await chrome.runtime.sendMessage({ type: "GET_PROXY_STATUS" });
    return result?.success === true && isSmolixProxyConfig(result.value);
  } catch {
    return false;
  }
}

async function localDisconnect() {
  const result = await chrome.runtime.sendMessage({ type: "DISCONNECT" });
  if (!result?.success) throw new Error(result?.message || "Не удалось отключить");
  isConnected = false;
  stopSessionTimer();
  stopLatencyMonitoring();
  setConnectionState("disconnected", "Подключиться");
  setAuthProxyBanner(false);
  setText("latencyValue", "—");
  setText("locationPing", "—");
  setText("brandSubtitle", "VPN");
  return result;
}

async function apiRequest(path, options = {}, token = null) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response = null;
  let lastError = null;

  for (const base of API_URLS) {
    try {
      response = await fetch(base + path, {
        ...options,
        headers,
        signal: AbortSignal.timeout(8000),
      });
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!response) throw lastError || new Error("API недоступен");

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `Ошибка сервера: ${response.status}`);
  }

  return data;
}

async function getToken() {
  const result = await chrome.storage.local.get("smolixToken");
  return result.smolixToken || null;
}

function countryFlag(country) {
  if (!country) return "🌍";
  return COUNTRY_FLAGS[country] || "🌍";
}

function setConnectionState(state, title) {
  const panel = $("connectionPanel");
  if (panel) {
    panel.classList.remove("connected", "connecting", "disconnecting", "error");
    if (state === "connected") panel.classList.add("connected");
    if (state === "connecting") panel.classList.add("connecting");
    if (state === "disconnecting") panel.classList.add("disconnecting");
    if (state === "error") panel.classList.add("error");
  }

  const kickers = {
    disconnected: "Защита отключена",
    connected: "Защита активна",
    connecting: "Подключение",
    disconnecting: "Отключение",
    error: "Ошибка подключения",
  };

  setText("connectionKicker", kickers[state] || "Статус");
  setText("connectionTitle", title);
  setText("brandSubtitle", state === "connected" ? "Онлайн" : "VPN");

  if (state === "connected") setText("connectText", "Отключить");
  else if (state === "connecting") setText("connectText", "Подключение…");
  else if (state === "disconnecting") setText("connectText", "Отключение…");
  else setText("connectText", "Подключить");
}

function formatDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((v) => String(v).padStart(2, "0"))
    .join(":");
}

function startSessionTimer() {
  clearInterval(sessionTimer);
  const update = () => setText("sessionDuration", formatDuration(Date.now() - startedAt));
  update();
  sessionTimer = setInterval(update, 1000);
}

function stopSessionTimer() {
  clearInterval(sessionTimer);
  sessionTimer = null;
  setText("sessionDuration", "00:00:00");
}

async function checkLatency() {
  if (!isConnected) return;

  const started = performance.now();

  try {
    await fetch(`https://www.cloudflare.com/cdn-cgi/trace?smolix=${Date.now()}`, {
      method: "GET",
      cache: "no-store",
      mode: "no-cors",
      signal: AbortSignal.timeout(10000),
    });

    if (!isConnected) return;

    const elapsed = Math.round(performance.now() - started);
    setText("latencyValue", `${elapsed} мс`);
    setText("locationPing", `${elapsed} мс`);
  } catch {
    if (isConnected) {
      setText("latencyValue", "—");
      setText("locationPing", "—");
    }
  }
}

function startLatencyMonitoring() {
  stopLatencyMonitoring();
  checkLatency();
  latencyTimer = setInterval(checkLatency, 8000);
}

function stopLatencyMonitoring() {
  if (latencyTimer) {
    clearInterval(latencyTimer);
    latencyTimer = null;
  }
}

function setProxyMode(mode) {
  proxyMode = mode;
  $("youtubeMode")?.classList.toggle("active", mode === "youtube");
  $("fullMode")?.classList.toggle("active", mode === "full");
}

function updateConnectButtonAvailability() {
  const button = $("connectButton");
  if (!button) return;
  button.disabled = apiOffline && !isConnected;
}

async function restoreProxyStatus() {
  try {
    const result = await chrome.runtime.sendMessage({ type: "GET_PROXY_STATUS" });
    const storage = await chrome.storage.session.get([
      "smolixProxyCredentials",
      "smolixProxyStartedAt",
      "smolixProxyMode",
    ]);

    isConnected = result?.success === true && isSmolixProxyConfig(result.value);
    proxyMode =
      storage.smolixProxyMode ||
      (result?.value?.mode === "pac_script" ? "youtube" : "full");
    setProxyMode(proxyMode);
    setConnectionState(
      isConnected ? "connected" : "disconnected",
      isConnected ? "Подключено" : "Не подключено"
    );

    if (isConnected) {
      startedAt = storage.smolixProxyStartedAt || Date.now();
      startSessionTimer();
      startLatencyMonitoring();
    } else {
      stopSessionTimer();
      stopLatencyMonitoring();
      setText("latencyValue", "—");
      setText("locationPing", "—");
    }

    updateConnectButtonAvailability();
  } catch {
    setConnectionState("error", "Ошибка");
  }
}

async function enterOfflineMain(message) {
  apiOffline = true;
  const settings = $("settingsButton");
  if (settings) settings.hidden = false;
  setText("subscriptionTitle", "Офлайн");
  setText("subscriptionStatus", "API недоступен");
  const status = $("subscriptionStatus");
  if (status) status.className = "status-pill expired";
  showScreen("main");
  setOfflineBanner(true, message || "Нет соединения с API");
  await restoreProxyStatus();
  updateConnectButtonAvailability();
}

async function checkSession() {
  const token = await getToken();
  const subscriptionCard = $("subscriptionCard");
  const locationButton = $("locationButton");
  subscriptionCard?.classList.add("loading");
  locationButton?.classList.add("loading");
  setOfflineBanner(false);
  setAuthProxyBanner(false);
  apiOffline = false;

  if (!token) {
    subscriptionCard?.classList.remove("loading");
    locationButton?.classList.remove("loading");
    const settings = $("settingsButton");
    if (settings) settings.hidden = true;
    setAuthProxyBanner(await hasActiveProxy());
    const seen = await chrome.storage.local.get(ONBOARD_SEEN_KEY);
    if (!seen[ONBOARD_SEEN_KEY]) {
      showScreen("onboarding");
    } else {
      showScreen("auth");
    }
    return;
  }

  try {
    const data = await apiRequest("/extension/me", {}, token);
    const settings = $("settingsButton");
    if (settings) settings.hidden = false;
    renderSubscription(data.subscription);
    showScreen("main");
    setOfflineBanner(false);
    const tipState = await chrome.storage.local.get(FIRST_TIP_KEY);
    const tip = $("firstConnectTip");
    if (tip) tip.hidden = tipState[FIRST_TIP_KEY] === true;
    await loadServers(token);
    await restoreProxyStatus();
    updateConnectButtonAvailability();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";

    if (/сесси|авториза|UNAUTHORIZED|INVALID_SESSION|401|403/i.test(message)) {
      await chrome.storage.local.remove("smolixToken");
      showScreen("auth");
      const settings = $("settingsButton");
      if (settings) settings.hidden = true;
      setAuthProxyBanner(await hasActiveProxy());
      setText("authError", "Сессия истекла. Войдите снова.");
    } else if (isNetworkError(error)) {
      await enterOfflineMain("Нет соединения с API");
    } else {
      await enterOfflineMain(message || "Не удалось проверить аккаунт");
    }
  } finally {
    subscriptionCard?.classList.remove("loading");
    locationButton?.classList.remove("loading");
  }
}

function renderSubscription(subscription) {
  const title = $("subscriptionTitle");
  const status = $("subscriptionStatus");
  if (!subscription) {
    if (title) title.textContent = "Нет подписки";
    if (status) {
      status.textContent = "Неактивна";
      status.className = "status-pill expired";
    }
    return;
  }

  if (title) title.textContent = subscription.isTrial ? "Бесплатный период" : "Premium";
  if (status) {
    status.textContent = "Активна";
    status.className = "status-pill active";
  }
}

async function loadServers(token) {
  try {
    const data = await apiRequest(
      `/extension/servers?mode=${encodeURIComponent(proxyMode)}`,
      {},
      token
    );
    const servers = Array.isArray(data.servers) ? data.servers : [];
    if (!servers.length) return;

    const saved = await chrome.storage.local.get("smolixSelectedServerId");
    selectedServer =
      servers.find((s) => s.id === saved.smolixSelectedServerId) || servers[0];
    await chrome.storage.local.set({ smolixSelectedServerId: selectedServer.id });

    const country = selectedServer.country || selectedServer.name;
    setText("locationName", country);
    setText("locationFlag", countryFlag(country));
  } catch (error) {
    showToast(error.message || "Не удалось загрузить локации", "error");
  }
}

function renderEmptyState(container, icon, title, text) {
  container.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.innerHTML = `
    <div>
      <div class="empty-icon">${icon}</div>
      <strong>${title}</strong>
      <p>${text}</p>
    </div>
  `;
  container.appendChild(empty);
}

async function loadDevices() {
  const token = await getToken();
  if (!token) return;

  const list = $("devicesList");
  if (!list) return;

  try {
    const data = await apiRequest("/extension/devices", {}, token);
    list.replaceChildren();

    if (!data.devices?.length) {
      renderEmptyState(
        list,
        "💻",
        "Нет устройств",
        "Активные сессии расширения появятся здесь."
      );
      return;
    }

    data.devices.forEach((device) => {
      const card = document.createElement("div");
      card.className = "device-card";

      const info = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = device.isCurrent ? "Это устройство" : "Chrome Extension";
      const id = document.createElement("small");
      id.textContent = device.deviceId || device.id.slice(0, 8).toUpperCase();
      info.append(name, id);

      const date = document.createElement("span");
      date.textContent = device.lastUsedAt
        ? new Date(device.lastUsedAt).toLocaleString("ru-RU", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "Активно";

      card.append(info, date);
      list.appendChild(card);
    });
  } catch (error) {
    showToast(error.message || "Не удалось загрузить устройства", "error");
  }
}

async function getOrCreateDeviceId() {
  const stored = await chrome.storage.local.get("smolixDeviceId");
  if (stored.smolixDeviceId) return stored.smolixDeviceId;

  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  const deviceId = `SMX-${random}`;
  await chrome.storage.local.set({ smolixDeviceId: deviceId });
  return deviceId;
}

async function restorePreferences() {
  const stored = await chrome.storage.local.get(["smolixLanguage", "smolixTheme"]);
  const languageSelect = $("languageSelect");
  const themeSelect = $("themeSelect");

  if (languageSelect) languageSelect.value = stored.smolixLanguage || "ru";
  if (themeSelect) themeSelect.value = stored.smolixTheme || "light";
  applyTheme(themeSelect?.value || "light");
}

function applyTheme(theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark-theme", dark);
}

function bindPasswordToggle(inputId, toggleId) {
  const input = $(inputId);
  const toggle = $(toggleId);
  if (!input || !toggle) return;

  toggle.addEventListener("click", () => {
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    toggle.textContent = show ? "Скрыть" : "Показать";
  });
}

async function recordConnectionEvent(status, message = null) {
  const token = await getToken();
  if (!token) return;

  const saved = await chrome.storage.local.get("smolixSelectedServerId");

  try {
    await apiRequest(
      "/extension/history/event",
      {
        method: "POST",
        body: JSON.stringify({
          status,
          serverId: saved.smolixSelectedServerId || null,
          mode: proxyMode,
          message,
        }),
      },
      token
    );
  } catch {}
}

async function openServers() {
  showScreen("servers");
  const token = await getToken();
  if (!token) return;

  const list = $("serversList");
  if (!list) return;

  try {
    const data = await apiRequest(
      `/extension/servers?mode=${encodeURIComponent(proxyMode)}`,
      {},
      token
    );
    const servers = Array.isArray(data.servers) ? data.servers : [];
    list.replaceChildren();

    if (!servers.length) {
      renderEmptyState(
        list,
        "🌍",
        "Серверов пока нет",
        "Доступные локации появятся после настройки API."
      );
      return;
    }

    const saved = await chrome.storage.local.get("smolixSelectedServerId");

    servers.forEach((server, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "server-card";
      if (saved.smolixSelectedServerId === server.id) button.classList.add("selected");

      const main = document.createElement("div");
      main.className = "server-main";

      const name = document.createElement("strong");
      name.textContent = server.name;

      const country = document.createElement("small");
      country.textContent = server.country || "Россия";
      main.append(name, country);

      const side = document.createElement("div");
      side.className = "server-side";

      const flag = document.createElement("span");
      flag.className = "server-flag";
      flag.textContent = countryFlag(server.country || server.name);

      const ping = document.createElement("span");
      ping.className = "server-ping";
      const estimate = 28 + ((index * 17 + (server.name?.length || 0) * 3) % 90);
      ping.textContent = `${estimate} мс`;

      side.append(flag, ping);
      button.append(main, side);

      button.addEventListener("click", async () => {
        await chrome.storage.local.set({ smolixSelectedServerId: server.id });
        selectedServer = server;
        const label = server.country || server.name;
        setText("locationName", label);
        setText("locationFlag", countryFlag(label));
        setText("locationPing", ping.textContent);
        showToast("Локация выбрана", "success");
        showScreen("main");
      });

      list.appendChild(button);
    });
  } catch (error) {
    showToast(error.message || "Не удалось загрузить серверы", "error");
  }
}

async function openHistory() {
  showScreen("history");
  const token = await getToken();
  if (!token) return;

  const list = $("historyList");
  if (!list) return;

  try {
    const data = await apiRequest("/extension/history", {}, token);
    list.replaceChildren();

    if (!data.history?.length) {
      renderEmptyState(
        list,
        "⏱",
        "История пуста",
        "Подключения и отключения будут отображаться здесь."
      );
      return;
    }

    data.history.forEach((item) => {
      const card = document.createElement("div");
      card.className = `history-card ${item.status.toLowerCase()}`;

      const title = document.createElement("strong");
      title.textContent =
        item.status === "CONNECTED"
          ? "Подключено"
          : item.status === "FAILED"
            ? "Ошибка"
            : "Отключено";

      const meta = document.createElement("span");
      meta.textContent = `${item.mode === "youtube" ? "YouTube" : "Весь интернет"} · ${new Date(
        item.startedAt
      ).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}`;

      card.append(title, meta);
      list.appendChild(card);
    });
  } catch (error) {
    showToast(error.message || "Не удалось загрузить историю", "error");
  }
}

/* Events */
$("youtubeMode")?.addEventListener("click", () => setProxyMode("youtube"));
$("fullMode")?.addEventListener("click", () => setProxyMode("full"));
$("settingsButton")?.addEventListener("click", () => showScreen("settings"));
$("settingsBack")?.addEventListener("click", () => showScreen("main"));
$("recoveryButton")?.addEventListener("click", () => showScreen("recovery"));
$("recoveryBack")?.addEventListener("click", () => showScreen("auth"));

$("authModeButton")?.addEventListener("click", () => {
  authMode = authMode === "login" ? "register" : "login";
  authFormStartedAt = Date.now();
  setText("authEyebrow", authMode === "register" ? "Новый аккаунт" : "С возвращением");
  setText("authTitle", authMode === "register" ? "Создайте аккаунт" : "Войдите в jetsale.online");
  setText("authSubmit", authMode === "register" ? "Зарегистрироваться" : "Войти");
  setText(
    "authModeButton",
    authMode === "register"
      ? "Уже есть аккаунт? Войти"
      : "Нет аккаунта? Зарегистрироваться"
  );
  const password = $("authPassword");
  if (password) password.minLength = authMode === "register" ? 8 : 1;
  setText("authError", "");
});

bindPasswordToggle("authPassword", "authPasswordToggle");
bindPasswordToggle("currentPassword", "currentPasswordToggle");
bindPasswordToggle("newPassword", "newPasswordToggle");

$("authForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("authEmail").value.trim().toLowerCase();
  const password = $("authPassword").value;
  const submit = $("authSubmit");
  submit.disabled = true;
  submit.textContent = authMode === "register" ? "Создание аккаунта…" : "Вход…";
  setText("authError", "");

  try {
    if (authMode === "register") {
      await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          formStartedAt: authFormStartedAt,
          website: "",
          company: "",
        }),
      });
    }

    const deviceId = await getOrCreateDeviceId();
    const data = await apiRequest("/extension/login", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        deviceName: "jetsale.online Chrome Extension",
        deviceId,
      }),
    });

    await chrome.storage.local.set({ smolixToken: data.token });
    $("authPassword").value = "";
    showToast("Вход выполнен", "success");
    await checkSession();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Не удалось выполнить вход";
    setText(
      "authError",
      isNetworkError(error)
        ? "Нет соединения с API. Запустите сервер или проверьте разрешения."
        : message
    );
  } finally {
    submit.disabled = false;
    submit.textContent = authMode === "register" ? "Зарегистрироваться" : "Войти";
  }
});

$("connectButton")?.addEventListener("click", async () => {
  const button = $("connectButton");
  button.disabled = true;

  if (isConnected) {
    setConnectionState("disconnecting", "Отключение");

    try {
      await localDisconnect();
      recordConnectionEvent("DISCONNECTED");
      showToast("VPN отключён", "success");
      updateConnectButtonAvailability();
    } catch (error) {
      setConnectionState("error", "Ошибка");
      recordConnectionEvent("FAILED", error.message || "Ошибка отключения");
      showToast(error.message || "Ошибка отключения", "error");
      button.disabled = false;
    }

    return;
  }

  if (apiOffline) {
    showToast("Подключение недоступно: нет соединения с API", "error");
    updateConnectButtonAvailability();
    return;
  }

  setConnectionState("connecting", "Подключение");

  try {
    const storage = await chrome.storage.local.get("smolixSelectedServerId");
    const result = await chrome.runtime.sendMessage({
      type: "CONNECT",
      serverId: storage.smolixSelectedServerId,
      mode: proxyMode,
    });

    if (!result?.success) throw new Error(result?.message || "Не удалось подключиться");

    isConnected = true;
    startedAt = result.startedAt || Date.now();
    startSessionTimer();
    startLatencyMonitoring();
    setConnectionState("connected", "Защита активна");
    recordConnectionEvent("CONNECTED");
    showToast(
      proxyMode === "youtube" ? "YouTube доступен" : "Полный интернет подключён",
      "success"
    );
  } catch (error) {
    setConnectionState("error", "Ошибка");
    recordConnectionEvent("FAILED", error.message || "Ошибка подключения");
    showToast(error.message || "Ошибка подключения", "error");
  } finally {
    updateConnectButtonAvailability();
  }
});

$("logoutButton")?.addEventListener("click", async () => {
  try {
    await localDisconnect();
  } catch {}

  const token = await getToken();
  if (token) {
    try {
      await apiRequest("/extension/logout", { method: "POST", body: "{}" }, token);
    } catch {}
  }

  await chrome.storage.local.remove(["smolixToken", "smolixSelectedServerId"]);
  apiOffline = false;
  setOfflineBanner(false);
  setAuthProxyBanner(false);
  showScreen("auth");
  const settings = $("settingsButton");
  if (settings) settings.hidden = true;
  showToast("Вы вышли из аккаунта", "success");
});

$("devicesButton")?.addEventListener("click", async () => {
  showScreen("devices");
  await loadDevices();
});
$("devicesBack")?.addEventListener("click", () => showScreen("settings"));

$("revokeOthersButton")?.addEventListener("click", async () => {
  const token = await getToken();
  if (!token) return;

  try {
    await apiRequest(
      "/extension/devices/revoke-others",
      { method: "POST", body: "{}" },
      token
    );
    showToast("Другие устройства отключены", "success");
    await loadDevices();
  } catch (error) {
    showToast(error.message || "Не удалось отключить устройства", "error");
  }
});

$("locationButton")?.addEventListener("click", openServers);
$("serversBack")?.addEventListener("click", () => showScreen("main"));
$("historyButton")?.addEventListener("click", openHistory);
$("historyBack")?.addEventListener("click", () => showScreen("settings"));

$("diagnosticsButton")?.addEventListener("click", async () => {
  showToast("Проверяем подключение…");

  try {
    const result = await chrome.runtime.sendMessage({ type: "RUN_DIAGNOSTICS" });
    const d = result?.diagnostics;

    if (!d) {
      showToast("Диагностика недоступна", "error");
      return;
    }

    if (!d.api) {
      showToast("Ошибка: API недоступен", "error");
      return;
    }
    if (!d.credentials) {
      showToast("Нужна авторизация прокси", "error");
      return;
    }
    if (!d.proxyConfigured) {
      showToast("Chrome Proxy не настроен", "error");
      return;
    }

    showToast("Подключение настроено корректно", "success");
  } catch (error) {
    showToast(error.message || "Ошибка диагностики", "error");
  }
});

$("authEmergencyDisconnect")?.addEventListener("click", async () => {
  const button = $("authEmergencyDisconnect");
  if (button) button.disabled = true;
  try {
    await localDisconnect();
    showToast("VPN отключён", "success");
  } catch (error) {
    showToast(error.message || "Не удалось отключить VPN", "error");
  } finally {
    if (button) button.disabled = false;
  }
});

$("retryApiButton")?.addEventListener("click", () => {
  showToast("Проверяем API…");
  checkSession();
});

$("languageSelect")?.addEventListener("change", async (event) => {
  await chrome.storage.local.set({ smolixLanguage: event.target.value });
  showToast("Язык сохранён", "success");
});

$("themeSelect")?.addEventListener("change", async (event) => {
  await chrome.storage.local.set({ smolixTheme: event.target.value });
  applyTheme(event.target.value);
  showToast("Тема сохранена", "success");
});

$("recoveryForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("recoveryEmail").value.trim().toLowerCase();
  const submit = $("recoverySubmit");
  submit.disabled = true;
  submit.textContent = "Отправка…";
  setText("recoveryMessage", "");

  try {
    const data = await apiRequest("/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    setText("recoveryMessage", data.message || "Запрос отправлен.");
  } catch (error) {
    setText(
      "recoveryMessage",
      error instanceof Error ? error.message : "Не удалось отправить запрос"
    );
  } finally {
    submit.disabled = false;
    submit.textContent = "Отправить запрос";
  }
});

$("passwordButton")?.addEventListener("click", () => showScreen("password"));
$("passwordBack")?.addEventListener("click", () => showScreen("settings"));

$("passwordForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = await getToken();
  if (!token) return;

  const currentPassword = $("currentPassword").value;
  const newPassword = $("newPassword").value;
  const submit = $("passwordSubmit");
  submit.disabled = true;
  submit.textContent = "Смена…";
  setText("passwordMessage", "");

  try {
    const data = await apiRequest(
      "/extension/change-password",
      {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      },
      token
    );

    try {
      await localDisconnect();
    } catch {}

    await chrome.storage.local.remove("smolixToken");
    $("currentPassword").value = "";
    $("newPassword").value = "";
    apiOffline = false;
    setOfflineBanner(false);
    setAuthProxyBanner(false);
    showScreen("auth");
    const settingsBtn = $("settingsButton");
    if (settingsBtn) settingsBtn.hidden = true;
    showToast(data.message || "Пароль изменён", "success");
  } catch (error) {
    setText(
      "passwordMessage",
      error instanceof Error ? error.message : "Не удалось сменить пароль"
    );
  } finally {
    submit.disabled = false;
    submit.textContent = "Сменить пароль";
  }
});

chrome.storage.local.get("smolixAutoConnect").then((autoStored) => {
  const autoToggle = $("autoConnectToggle");
  if (autoToggle) autoToggle.checked = autoStored.smolixAutoConnect === true;
});

$("autoConnectToggle")?.addEventListener("change", async (event) => {
  await chrome.storage.local.set({ smolixAutoConnect: event.target.checked });
  showToast(
    event.target.checked ? "Автоподключение включено" : "Автоподключение отключено",
    "success"
  );
});

async function markOnboardSeen() {
  await chrome.storage.local.set({ [ONBOARD_SEEN_KEY]: true });
}

$("onboardContinue")?.addEventListener("click", async () => {
  await markOnboardSeen();
  showScreen("auth");
});

$("onboardSkip")?.addEventListener("click", async () => {
  await markOnboardSeen();
  showScreen("auth");
});

$("dismissFirstTip")?.addEventListener("click", async () => {
  await chrome.storage.local.set({ [FIRST_TIP_KEY]: true });
  const tip = $("firstConnectTip");
  if (tip) tip.hidden = true;
});

showScreen("auth");
restorePreferences();
checkSession();
