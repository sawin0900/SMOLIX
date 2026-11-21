const API_URLS = ["https://jetsale.online/api"];

const DEFAULT_PROXY_HOST = "rassiya.jetsale.online";
const DEFAULT_PROXY_PORT = 8443;

const PROXY_STORAGE_KEY = "smolixProxyCredentials";
const PROXY_STARTED_AT_KEY = "smolixProxyStartedAt";
const PROXY_MODE_KEY = "smolixProxyMode";
const PROXY_ENDPOINT_KEY = "smolixProxyEndpoint";

console.log("jetsale.online background service worker started");

async function getStoredProxyEndpoint() {
  const storage = await chrome.storage.session.get(PROXY_ENDPOINT_KEY);
  const endpoint = storage[PROXY_ENDPOINT_KEY];
  if (endpoint?.host && endpoint?.port) return endpoint;
  return { host: DEFAULT_PROXY_HOST, port: DEFAULT_PROXY_PORT };
}

async function getProxyCredentials(serverId, mode = "full") {
  const { smolixToken } = await chrome.storage.local.get("smolixToken");

  if (!smolixToken) {
    throw new Error("Необходимо войти в аккаунт jetsale.online");
  }

  const response = await fetch(
    `${API_URLS[0]}/extension/proxy?serverId=${encodeURIComponent(serverId)}&mode=${encodeURIComponent(mode)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${smolixToken}`,
        Accept: "application/json"
      }
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const messages = {
      UNAUTHORIZED: "Сессия истекла. Войдите в аккаунт заново.",
      INVALID_SESSION: "Сессия недействительна. Войдите заново.",
      ACCOUNT_DISABLED: "Аккаунт заблокирован.",
      SUBSCRIPTION_REQUIRED: "Trial кончился. YouTube бесплатно; для полного интернета откройте кабинет → Premium.",
      PROXY_NOT_CONFIGURED: data.message || "Локация выключена в админке или не настроен proxy host.",
      PROXY_MANAGER_MISSING: data.message || "Прокси на сервере не настроен (Proxy Manager). Напишите в поддержку.",
      PROXY_PROVISION_FAILED: data.message || "Не удалось выдать доступ к прокси. Попробуйте позже.",
      VPN_ACCOUNT_NOT_FOUND: "VPN-аккаунт не найден."
    };

    throw new Error(
      messages[data.code] ||
      data.message ||
      `Ошибка получения прокси: HTTP ${response.status}`
    );
  }

  if (
    !data.proxy ||
    data.proxy.scheme !== "https" ||
    !data.proxy.host ||
    !data.proxy.port ||
    !data.proxy.username ||
    !data.proxy.password
  ) {
    throw new Error("API вернул некорректные настройки прокси");
  }

  return {
    username: data.proxy.username,
    password: data.proxy.password,
    host: data.proxy.host,
    port: Number(data.proxy.port) || DEFAULT_PROXY_PORT,
  };
}

function buildFullModePac(proxyHost, proxyPort) {
  return `
    function FindProxyForURL(url, host) {
      var h = host.toLowerCase();

      if (h === "localhost" || h === "127.0.0.1" || shExpMatch(h, "127.*") ||
          shExpMatch(h, "10.*") || shExpMatch(h, "192.168.*") || shExpMatch(h, "172.16.*")) {
        return "DIRECT";
      }

      if (h === "${proxyHost}" || dnsDomainIs(h, ".jetsale.online")) {
        return "DIRECT";
      }

      if (dnsDomainIs(h, ".ru") || h === "ru" ||
          dnsDomainIs(h, ".xn--p1ai") ||
          dnsDomainIs(h, ".su") ||
          dnsDomainIs(h, ".yandex") || dnsDomainIs(h, ".yandex.net") || dnsDomainIs(h, ".yandex.ru") ||
          dnsDomainIs(h, ".ya.ru") || dnsDomainIs(h, ".yandex.com") ||
          dnsDomainIs(h, ".vk.com") || dnsDomainIs(h, ".vk.ru") || dnsDomainIs(h, ".vk.me") ||
          dnsDomainIs(h, ".vkuservideo.net") || dnsDomainIs(h, ".userapi.com") ||
          dnsDomainIs(h, ".ok.ru") || dnsDomainIs(h, ".odnoklassniki.ru") ||
          dnsDomainIs(h, ".mail.ru") || dnsDomainIs(h, ".imgsmail.ru") || dnsDomainIs(h, ".mycdn.me") ||
          dnsDomainIs(h, ".sberbank.ru") || dnsDomainIs(h, ".sber.ru") || dnsDomainIs(h, ".sberbank.com") ||
          dnsDomainIs(h, ".tinkoff.ru") || dnsDomainIs(h, ".tbank.ru") ||
          dnsDomainIs(h, ".alfabank.ru") || dnsDomainIs(h, ".vtb.ru") ||
          dnsDomainIs(h, ".gosuslugi.ru") || dnsDomainIs(h, ".mos.ru") ||
          dnsDomainIs(h, ".nalog.ru") || dnsDomainIs(h, ".cbr.ru") ||
          dnsDomainIs(h, ".wildberries.ru") || dnsDomainIs(h, ".wb.ru") || dnsDomainIs(h, ".wbbasket.ru") ||
          dnsDomainIs(h, ".ozon.ru") || dnsDomainIs(h, ".ozonusercontent.com") ||
          dnsDomainIs(h, ".avito.ru") || dnsDomainIs(h, ".avito.st") ||
          dnsDomainIs(h, ".dns-shop.ru") || dnsDomainIs(h, ".citilink.ru") ||
          dnsDomainIs(h, ".mvideo.ru") || dnsDomainIs(h, ".eldorado.ru") ||
          dnsDomainIs(h, ".hh.ru") || dnsDomainIs(h, ".2gis.ru") || dnsDomainIs(h, ".2gis.com") ||
          dnsDomainIs(h, ".rzd.ru") || dnsDomainIs(h, ".pochta.ru") ||
          dnsDomainIs(h, ".dnevnik.ru") || dnsDomainIs(h, ".edu.ru") ||
          dnsDomainIs(h, ".rutube.ru") || dnsDomainIs(h, ".ivi.ru") ||
          dnsDomainIs(h, ".kinopoisk.ru") || dnsDomainIs(h, ".kp.ru") ||
          dnsDomainIs(h, ".cloud.yandex.net") || dnsDomainIs(h, ".storage.yandex.net") ||
          dnsDomainIs(h, ".yastatic.net") || dnsDomainIs(h, ".yandex-team.ru")) {
        return "DIRECT";
      }

      return "HTTPS ${proxyHost}:${proxyPort}";
    }
  `;
}

function setChromeProxy(mode = "full", proxyHost = DEFAULT_PROXY_HOST, proxyPort = DEFAULT_PROXY_PORT) {
  return new Promise((resolve, reject) => {
    const value = mode === "youtube"
      ? {
          mode: "pac_script",
          pacScript: {
            data: `
              function FindProxyForURL(url, host) {
                var h = host.toLowerCase();
                if (h === "youtube.com" || dnsDomainIs(h, ".youtube.com") ||
                    h === "youtu.be" || dnsDomainIs(h, ".youtu.be") ||
                    h === "googlevideo.com" || dnsDomainIs(h, ".googlevideo.com") ||
                    h === "ytimg.com" || dnsDomainIs(h, ".ytimg.com") ||
                    h === "ggpht.com" || dnsDomainIs(h, ".ggpht.com")) {
                  return "HTTPS ${proxyHost}:${proxyPort}";
                }
                return "DIRECT";
              }
            `
          }
        }
      : {
          mode: "pac_script",
          pacScript: {
            data: buildFullModePac(proxyHost, proxyPort)
          }
        };

    chrome.proxy.settings.set(
      { value, scope: "regular" },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve();
      }
    );
  });
}

function clearChromeProxy() {
  return new Promise((resolve, reject) => {
    chrome.proxy.settings.clear(
      { scope: "regular" },
      () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve();
      }
    );
  });
}

async function connect(serverId, mode = "full") {
  if (!serverId) {
    throw new Error("Сначала выберите сервер");
  }

  const credentials = await getProxyCredentials(serverId, mode);
  const endpoint = { host: credentials.host, port: credentials.port };

  await chrome.storage.session.set({
    [PROXY_STORAGE_KEY]: {
      username: credentials.username,
      password: credentials.password,
    },
    [PROXY_MODE_KEY]: mode,
    [PROXY_ENDPOINT_KEY]: endpoint,
  });

  try {
    await setChromeProxy(mode, endpoint.host, endpoint.port);

    const startedAt = Date.now();

    await chrome.storage.session.set({
      [PROXY_STARTED_AT_KEY]: startedAt,
      [PROXY_MODE_KEY]: mode
    });

    await setActionState("connected");

    return {
      success: true,
      startedAt,
      message: "Подключение к серверу настроено"
    };
  } catch (error) {
    await chrome.storage.session.remove([
      PROXY_STORAGE_KEY,
      PROXY_STARTED_AT_KEY,
      PROXY_ENDPOINT_KEY,
    ]);

    await setActionState("error");

    throw error;
  }
}

async function disconnect() {
  await clearChromeProxy();

  await chrome.storage.session.remove([
    PROXY_STORAGE_KEY,
    PROXY_STARTED_AT_KEY,
    PROXY_MODE_KEY,
    PROXY_ENDPOINT_KEY,
  ]);

  await setActionState("disconnected");

  return {
    success: true,
    message: "Прокси отключён"
  };
}

async function validateActiveAccess() {
  const { smolixToken } = await chrome.storage.local.get("smolixToken");

  if (!smolixToken) {
    await disconnect();
    return false;
  }

  try {
    const response = await fetch(`${API_URLS[0]}/extension/me`, {
      headers: {
        Authorization: `Bearer ${smolixToken}`,
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      await disconnect();
      return false;
    }

    const data = await response.json().catch(() => ({}));
    const storage = await chrome.storage.session.get(PROXY_MODE_KEY);

    if (
      storage[PROXY_MODE_KEY] === "full" &&
      (!data.subscription?.status || data.subscription.status !== "ACTIVE")
    ) {
      await disconnect();
      await showVpnNotification("jetsale.online Premium", "Активная подписка завершилась. Подключите Premium для полного интернета.");
      return false;
    }

    return true;
  } catch (error) {
    console.error("jetsale.online access validation error:", error);
    return false;
  }
}

chrome.runtime.onStartup?.addListener(() => {
  syncActionFromProxyStatus().catch((error) => {
    console.error("jetsale.online startup badge sync error:", error);
  });

  validateActiveAccess().catch((error) => {
    console.error("jetsale.online startup access validation error:", error);
  });
});

chrome.runtime.onInstalled.addListener(() => {
  syncActionFromProxyStatus().catch((error) => {
    console.error("jetsale.online install badge sync error:", error);
  });

  chrome.alarms.create("smolix-access-check", {
    periodInMinutes: 5
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== "smolix-access-check") return;

  validateActiveAccess().catch((error) => {
    console.error("jetsale.online scheduled access validation error:", error);
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CONNECT") {
    connect(message.serverId, message.mode)
      .then(sendResponse)
      .catch((error) => {
        console.error("jetsale.online CONNECT error:", error);

        sendResponse({
          success: false,
          error: "CONNECT_FAILED",
          message: error.message
        });
      });

    return true;
  }

  if (message?.type === "DISCONNECT") {
    disconnect()
      .then(sendResponse)
      .catch((error) => {
        console.error("jetsale.online DISCONNECT error:", error);

        sendResponse({
          success: false,
          message: error.message
        });
      });

    return true;
  }

  if (message?.type === "GET_PROXY_STATUS") {
    chrome.proxy.settings.get({ incognito: false }, async (details) => {
      if (chrome.runtime.lastError) {
        sendResponse({
          success: false,
          message: chrome.runtime.lastError.message
        });
        return;
      }

      const endpoint = await getStoredProxyEndpoint();
      sendResponse({
        success: true,
        value: details.value,
        endpoint,
      });
    });

    return true;
  }

  if (message?.type === "RUN_DIAGNOSTICS") {
    (async () => {
      const { smolixToken } = await chrome.storage.local.get("smolixToken");
      let api = false;
      try {
        const res = await fetch(`${API_URLS[0]}/health`, { signal: AbortSignal.timeout(5000) });
        api = res.ok;
      } catch {
        api = false;
      }

      const creds = await chrome.storage.session.get(PROXY_STORAGE_KEY);
      const endpoint = await getStoredProxyEndpoint();

      const proxyConfigured = await new Promise((resolve) => {
        chrome.proxy.settings.get({ incognito: false }, (details) => {
          const pac = details?.value?.pacScript?.data || "";
          resolve(
            details?.value?.mode === "pac_script" &&
            pac.includes(endpoint.host)
          );
        });
      });

      sendResponse({
        success: true,
        diagnostics: {
          api,
          credentials: Boolean(creds[PROXY_STORAGE_KEY]),
          proxyConfigured,
          token: Boolean(smolixToken),
          endpoint,
        }
      });
    })().catch((error) => {
      sendResponse({ success: false, message: error.message });
    });

    return true;
  }

  return false;
});

chrome.webRequest.onAuthRequired.addListener(
  (details, callback) => {
    chrome.storage.session.get([PROXY_STORAGE_KEY, PROXY_ENDPOINT_KEY]).then((storage) => {
      const credentials = storage[PROXY_STORAGE_KEY];
      const endpoint = storage[PROXY_ENDPOINT_KEY] || {
        host: DEFAULT_PROXY_HOST,
        port: DEFAULT_PROXY_PORT,
      };

      if (
        !credentials ||
        details.challenger?.host !== endpoint.host ||
        details.isProxy !== true
      ) {
        callback();
        return;
      }

      callback({
        authCredentials: {
          username: credentials.username,
          password: credentials.password
        }
      });
    }).catch((error) => {
      console.error("jetsale.online proxy authentication error:", error);
      callback();
    });
  },
  { urls: ["<all_urls>"] },
  ["asyncBlocking"]
);

async function setActionState(state) {
  if (state === "connected") {
    await chrome.action.setBadgeText({ text: "ON" });
    await chrome.action.setBadgeBackgroundColor({ color: "#0f766e" });
    return;
  }
  if (state === "error") {
    await chrome.action.setBadgeText({ text: "!" });
    await chrome.action.setBadgeBackgroundColor({ color: "#be123c" });
    return;
  }
  await chrome.action.setBadgeText({ text: "" });
}

async function syncActionFromProxyStatus() {
  return new Promise((resolve) => {
    chrome.proxy.settings.get({ incognito: false }, async (details) => {
      const endpoint = await getStoredProxyEndpoint();
      const pac = details?.value?.pacScript?.data || "";
      const connected =
        details?.value?.mode === "pac_script" &&
        pac.includes(endpoint.host);

      if (connected) {
        setActionState("connected").then(resolve);
      } else {
        setActionState("disconnected").then(resolve);
      }
    });
  });
}

async function showVpnNotification(title, message) {
  try {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title,
      message,
    });
  } catch {
    /* notifications optional */
  }
}
