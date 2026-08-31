// background.js — service worker MV3
// Branche "Éclat/Skolengo" : au lieu d'un simple fetch (impossible ici car le
// parcours de connexion CAS nécessite plusieurs clics), on ouvre un onglet
// invisible, on y injecte un script qui reconnaît chaque étape du parcours
// et clique automatiquement, jusqu'à atteindre soit la page finale de l'ENT
// (vérification du mot-clé), soit un état inattendu (notification d'anomalie).

const ALARM_NAME = "checkENT";
const DEFAULT_INTERVAL_MIN = 2;
const DEFAULT_KEYWORD = "Procédure de changement d'année";

const MAX_RESTARTS = 3;       // nb max de redémarrages du parcours (cas "reconnexion")
const OVERALL_TIMEOUT_MS = 60000; // délai max pour tout le parcours

// ---- Utilitaires stockage ----
async function getConfig() {
  const defaults = {
    entUrl: "", // URL de connexion CAS, ex: https://cas.eclat-bfc.fr/login?service=...
    keyword: DEFAULT_KEYWORD,
    matchMode: "absent", // "contains" = dispo si le texte APPARAÎT ; "absent" = dispo si le texte a DISPARU
    ntfyServer: "https://ntfy.sh",
    ntfyTopic: "",
    intervalMin: DEFAULT_INTERVAL_MIN,
    stoppedUntilDate: null,
    lastCheck: null,
    lastStatus: null, // "found" | "not_found" | "error" | "anomaly"
    lastError: null,
    alreadyNotifiedDate: null
  };
  const stored = await chrome.storage.local.get(Object.keys(defaults));
  return { ...defaults, ...stored };
}

async function setConfig(partial) {
  await chrome.storage.local.set(partial);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ---- Notifications ----
async function sendNtfy(config, title, message, tags) {
  if (!config.ntfyTopic) return;
  const base = config.ntfyServer.replace(/\/$/, "");
  try {
    await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ topic: config.ntfyTopic, title, message, priority: 3, tags })
    });
  } catch (e) {
    console.error("Erreur envoi ntfy:", e);
  }
}

function sendChromeNotification(id, title, message) {
  chrome.notifications.create(id, {
    type: "basic",
    iconUrl: "icon.png",
    title,
    message,
    priority: 2
  });
}

// ---- Script injecté dans l'onglet d'automatisation ----
// IMPORTANT : cette fonction s'exécute dans le contexte de la page (monde isolé
// de l'extension). Elle ne doit dépendre d'aucune variable extérieure autre que
// ses arguments, car elle est sérialisée par chrome.scripting.executeScript.
function automationStep(keywordRaw, matchMode) {
  function normalizeApostrophes(str) {
    return str.replace(/[\u2018\u2019\u02BC`]/g, "'");
  }
  function pageText() {
    return normalizeApostrophes((document.body ? document.body.innerText : "").toLowerCase());
  }
  function waitFor(selector, timeout) {
    return new Promise((resolve) => {
      const existing = document.querySelector(selector);
      if (existing) return resolve(existing);
      const obs = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          obs.disconnect();
          clearTimeout(timer);
          resolve(el);
        }
      });
      obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
      const timer = setTimeout(() => {
        obs.disconnect();
        resolve(null);
      }, timeout);
    });
  }
  function waitStable(quiet, hardTimeout) {
    return new Promise((resolve) => {
      let quietTimer;
      const finish = () => {
        obs.disconnect();
        clearTimeout(hardTimer);
        resolve();
      };
      const obs = new MutationObserver(() => {
        clearTimeout(quietTimer);
        quietTimer = setTimeout(finish, quiet);
      });
      obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      quietTimer = setTimeout(finish, quiet);
      const hardTimer = setTimeout(finish, hardTimeout);
    });
  }
  function send(result, extra) {
    chrome.runtime.sendMessage(Object.assign({ type: "ENT_ECLAT_RESULT", result }, extra || {}));
  }
  function findByText(selector, text) {
    const t = normalizeApostrophes(text.toLowerCase());
    return Array.from(document.querySelectorAll(selector)).find((el) =>
      normalizeApostrophes((el.textContent || "").toLowerCase()).includes(t)
    );
  }

  (async () => {
    try {
      // On distingue : sommes-nous encore dans le parcours de connexion CAS/IdP,
      // ou sur la page finale (l'ENT proprement dit) ?
      const isCasEcosystem = !!document.querySelector(
        ".cas__panel, .msg, #idp-EDU, .js-wayftoggle, #bouton_eleve, #bouton_valider, .choixProfil__btn"
      );

      if (isCasEcosystem) {
        // Étape 1 : page de connexion CAS — choix "Élève" puis "des collèges et des lycées"
        const wayfToggle = document.querySelector(".js-wayftoggle");
        const radioAlreadyThere = document.querySelector("#idp-EDU");
        if (wayfToggle && !radioAlreadyThere) {
          wayfToggle.click();
        }
        const radio = document.querySelector("#idp-EDU") || (await waitFor("#idp-EDU", 4000));
        if (radio) {
          if (!radio.checked) radio.click();
          const submitBtn = await waitFor("#button-submit", 4000);
          if (submitBtn) {
            submitBtn.click();
            return;
          }
        }

        // Étape 2 : choix du profil "Élève" sur l'IdP, puis validation
        const btnEleve = document.querySelector("#bouton_eleve");
        if (btnEleve) {
          btnEleve.click();
          const btnValider = await waitFor("#bouton_valider", 5000);
          if (btnValider) {
            btnValider.click();
            return;
          }
        }

        // On laisse la page se stabiliser avant d'analyser son contenu
        await waitStable(600, 4000);
        const text = pageText();

        // Étape 3a : "Application non autorisée à utiliser CAS" -> on relance la connexion
        if (text.includes("application non autoris")) {
          const relogin =
            findByText("a.btn.btn--primary", "se connecter à nouveau") ||
            document.querySelector('a[href="/login"]');
          if (relogin) {
            relogin.click();
            return;
          }
        }

        // Étape 3d : "Vous souhaitez vous connecter à votre ENT en tant que :" -> on repart du début
        if (text.includes("vous souhaitez vous connecter") && text.includes("en tant que")) {
          send("restart");
          return;
        }

        // Étape 3b bis : message de maintenance de rentrée ("Procédure de changement
        // d'année" / "votre ENT est indisponible jusqu'au ...") -> ce n'est pas une
        // anomalie, l'ENT n'est simplement pas encore ouvert, on réessaiera plus tard.
        if (text.includes("changement d'année") || text.includes("ent est indisponible")) {
          send("waiting");
          return;
        }

        // Étape 3c : "Connexion réussie" -> on clique le lien vers l'établissement
        const successPanel = document.querySelector(".msg--success");
        if (successPanel) {
          const link =
            document.querySelector('.panel--outlined.cas__panel a[href*="eclat-bfc.fr/login"]') ||
            document.querySelector(".panel__body a[href]");
          if (link) {
            link.click();
            return;
          }
        }

        // Toujours dans l'écosystème CAS mais rien de connu ne correspond -> anomalie
        send("anomaly", { url: location.href, excerpt: text.slice(0, 500) });
        return;
      }

      // Hors écosystème CAS : on considère qu'on est sur la page finale de l'ENT
      await waitStable(500, 4000);
      const finalText = pageText();
      const keyword = normalizeApostrophes(String(keywordRaw || "").toLowerCase());
      const hasKeyword = keyword ? finalText.includes(keyword) : false;
      const found = matchMode === "contains" ? hasKeyword : !hasKeyword;
      send(found ? "available" : "waiting", { url: location.href });
    } catch (e) {
      send("error", { message: String(e && e.message ? e.message : e) });
    }
  })();
}

// ---- Orchestration : ouvre l'onglet, réinjecte le script à chaque navigation ----
function runAutomation(config) {
  return new Promise((resolve) => {
    let tabId = null;
    let restarts = 0;
    let settled = false;
    let overallTimer = null;
    let updatedListener = null;
    let messageListener = null;

    function cleanup() {
      if (updatedListener) chrome.tabs.onUpdated.removeListener(updatedListener);
      if (messageListener) chrome.runtime.onMessage.removeListener(messageListener);
      if (overallTimer) clearTimeout(overallTimer);
      if (tabId !== null) {
        chrome.tabs.remove(tabId).catch(() => {});
      }
    }

    function finish(result) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    }

    function inject() {
      chrome.scripting
        .executeScript({
          target: { tabId },
          func: automationStep,
          args: [config.keyword, config.matchMode]
        })
        .catch((e) => {
          finish({ status: "error", error: "Injection impossible : " + (e && e.message ? e.message : e) });
        });
    }

    updatedListener = (id, changeInfo) => {
      if (id === tabId && changeInfo.status === "complete") {
        inject();
      }
    };

    messageListener = (msg, sender) => {
      if (!sender.tab || sender.tab.id !== tabId || msg?.type !== "ENT_ECLAT_RESULT") return;

      if (msg.result === "restart") {
        restarts += 1;
        if (restarts > MAX_RESTARTS) {
          finish({ status: "anomaly", error: "Trop de redémarrages de la connexion (session instable)." });
          return;
        }
        chrome.tabs.update(tabId, { url: config.entUrl });
        return;
      }
      if (msg.result === "waiting") {
        finish({ status: "not_found" });
        return;
      }
      if (msg.result === "available") {
        finish({ status: "found" });
        return;
      }
      if (msg.result === "anomaly") {
        finish({
          status: "anomaly",
          error: "Page inattendue rencontrée pendant la connexion.",
          detail: msg
        });
        return;
      }
      if (msg.result === "error") {
        finish({ status: "error", error: msg.message || "Erreur inconnue pendant l'automatisation." });
        return;
      }
    };

    chrome.tabs.onUpdated.addListener(updatedListener);
    chrome.runtime.onMessage.addListener(messageListener);

    overallTimer = setTimeout(() => {
      finish({ status: "error", error: "Délai dépassé pendant la vérification (parcours de connexion trop long)." });
    }, OVERALL_TIMEOUT_MS);

    chrome.tabs
      .create({ url: config.entUrl, active: false })
      .then((tab) => {
        tabId = tab.id;
      })
      .catch((e) => {
        finish({ status: "error", error: "Impossible d'ouvrir l'onglet : " + (e && e.message ? e.message : e) });
      });
  });
}

// ---- Vérification principale ----
async function checkENT() {
  const config = await getConfig();

  if (config.stoppedUntilDate === todayStr()) {
    return;
  }

  if (!config.entUrl) {
    await setConfig({
      lastStatus: "error",
      lastError: "Aucune URL de connexion CAS configurée.",
      lastCheck: Date.now()
    });
    return;
  }

  const result = await runAutomation(config);

  await setConfig({
    lastCheck: Date.now(),
    lastStatus: result.status,
    lastError: result.status === "error" || result.status === "anomaly" ? result.error : null
  });

  if (result.status === "found" && config.alreadyNotifiedDate !== todayStr()) {
    sendChromeNotification(
      "ent-espace-eleve",
      "Espace élève disponible !",
      "L'espace élève semble maintenant disponible sur votre ENT."
    );
    await sendNtfy(
      config,
      "Espace élève disponible !",
      "L'espace élève semble maintenant disponible sur votre ENT. Va vite vérifier !",
      ["tada", "school"]
    );
    await setConfig({ alreadyNotifiedDate: todayStr() });
  } else if (result.status === "not_found" && config.alreadyNotifiedDate === todayStr()) {
    // Se réarme si l'état retombe à "non disponible", pour ne pas rater
    // une vraie ouverture plus tard dans la journée.
    await setConfig({ alreadyNotifiedDate: null });
  }

  if (result.status === "anomaly") {
    sendChromeNotification(
      "ent-watcher-anomaly",
      "ENT Watcher — anomalie",
      result.error || "Page inattendue rencontrée pendant la vérification."
    );
    const detailLines = [];
    if (result.detail?.url) detailLines.push(`URL : ${result.detail.url}`);
    if (result.detail?.excerpt) detailLines.push(`Texte : ${result.detail.excerpt.slice(0, 300)}`);
    await sendNtfy(
      config,
      "ENT Watcher — anomalie",
      (result.error || "Page inattendue rencontrée.") + (detailLines.length ? "\n" + detailLines.join("\n") : ""),
      ["warning", "school"]
    );
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
  if (msg?.type === "GET_ALARM_INFO") {
    chrome.alarms.get(ALARM_NAME).then((alarm) => sendResponse({ alarm: alarm || null }));
    return true;
  }
});
