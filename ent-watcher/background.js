// background.js — service worker MV3

const ALARM_NAME = "checkENT";
const DEFAULT_INTERVAL_MIN = 5;

// ---- Utilitaires stockage ----
async function getConfig() {
  const defaults = {
    entUrl: "",
    keyword: "n'est pas publié par l'établissement",
    matchMode: "absent", // "contains" = dispo si le texte APPARAÎT ; "absent" = dispo si le texte a DISPARU
    ntfyServer: "https://ntfy.sh",
    ntfyTopic: "",
    intervalMin: DEFAULT_INTERVAL_MIN,
    stoppedUntilDate: null, // "YYYY-MM-DD" -> vérifications suspendues pour cette date
    lastCheck: null,
    lastStatus: null, // "found" | "not_found" | "error"
    lastError: null,
    alreadyNotifiedDate: null // pour éviter de spammer une fois trouvé
  };
  const stored = await chrome.storage.local.get(Object.keys(defaults));
  return { ...defaults, ...stored };
}

async function setConfig(partial) {
  await chrome.storage.local.set(partial);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ---- Notification ntfy ----
async function sendNtfyNotification(config) {
  if (!config.ntfyTopic) return;
  const base = config.ntfyServer.replace(/\/$/, "");
  try {
    await fetch(base, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify({
        topic: config.ntfyTopic,
        title: "Espace élève disponible !",
        message: "L'espace élève semble maintenant disponible sur votre ENT. Va vite vérifier !",
        priority: 3, // 3 = default
        tags: ["tada", "school"]
      })
    });
  } catch (e) {
    console.error("Erreur envoi ntfy:", e);
  }
}

function sendChromeNotification() {
  chrome.notifications.create("ent-espace-eleve", {
    type: "basic",
    iconUrl: "icon.png",
    title: "Espace élève disponible !",
    message: "L'espace élève semble maintenant disponible sur votre ENT.",
    priority: 2
  });
}

function normalizeApostrophes(str) {
  return str.replace(/[\u2018\u2019\u02BC`]/g, "'");
}

// ---- Vérification principale ----
async function checkENT() {
  const config = await getConfig();

  // Vérifications suspendues pour aujourd'hui ?
  if (config.stoppedUntilDate === todayStr()) {
    return;
  }

  if (!config.entUrl) {
    await setConfig({ lastStatus: "error", lastError: "Aucune URL ENT configurée.", lastCheck: Date.now() });
    return;
  }

  try {
    const response = await fetch(config.entUrl, {
      credentials: "include",
      cache: "no-store"
    });
    const rawText = await response.text();
    const text = normalizeApostrophes(rawText.toLowerCase());
    const keyword = normalizeApostrophes(config.keyword.toLowerCase());
    const textHasKeyword = text.includes(keyword);
    const found = config.matchMode === "absent" ? !textHasKeyword : textHasKeyword;

    await setConfig({
      lastCheck: Date.now(),
      lastStatus: found ? "found" : "not_found",
      lastError: null
    });

    if (found && config.alreadyNotifiedDate !== todayStr()) {
      sendChromeNotification();
      await sendNtfyNotification(config);
      await setConfig({ alreadyNotifiedDate: todayStr() });
    } else if (!found && config.alreadyNotifiedDate === todayStr()) {
      // Se réarme si l'état retombe à "non disponible" (ex: après une fausse détection),
      // pour ne pas rater une vraie ouverture plus tard dans la journée.
      await setConfig({ alreadyNotifiedDate: null });
    }
  } catch (e) {
    await setConfig({
      lastCheck: Date.now(),
      lastStatus: "error",
      lastError: String(e && e.message ? e.message : e)
    });
  }
}

// ---- Alarme ----
async function setupAlarm() {
  const config = await getConfig();
  await chrome.alarms.clear(ALARM_NAME);
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: config.intervalMin || DEFAULT_INTERVAL_MIN });
}

chrome.runtime.onInstalled.addListener(() => {
  setupAlarm();
});

chrome.runtime.onStartup.addListener(() => {
  setupAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    checkENT();
  }
});

// Permet au popup/options de déclencher une vérification immédiate
// ou de relancer l'alarme après un changement d'intervalle.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "CHECK_NOW") {
    checkENT().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === "RELOAD_ALARM") {
    setupAlarm().then(() => sendResponse({ ok: true }));
    return true;
  }
});
