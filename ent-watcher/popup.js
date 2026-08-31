function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(ts) {
  if (!ts) return "jamais";
  const d = new Date(ts);
  return d.toLocaleString("fr-FR");
}

const statusLabels = {
  found: "✅ Disponible !",
  not_found: "⏳ Pas encore",
  error: "⚠️ Erreur",
  unknown: "—"
};

async function refreshUI() {
  const config = await chrome.storage.local.get([
    "lastCheck", "lastStatus", "lastError", "stoppedUntilDate", "entUrl"
  ]);

  const badge = document.getElementById("statusBadge");
  const status = config.lastStatus || "unknown";
  badge.textContent = statusLabels[status] || "—";
  badge.className = "badge " + status;

  document.getElementById("lastCheck").textContent = formatDate(config.lastCheck);

  const errorRow = document.getElementById("errorRow");
  if (status === "error" && config.lastError) {
    errorRow.style.display = "flex";
    document.getElementById("errorMsg").textContent = config.lastError;
  } else {
    errorRow.style.display = "none";
  }

  const stopBtn = document.getElementById("stopBtn");
  const stoppedToday = config.stoppedUntilDate === todayStr();
  if (stoppedToday) {
    stopBtn.textContent = "Reprendre les vérifications";
    stopBtn.classList.add("active");
  } else {
    stopBtn.textContent = "Arrêter pour aujourd'hui";
    stopBtn.classList.remove("active");
  }

  document.getElementById("checkNowBtn").disabled = !config.entUrl;
  if (!config.entUrl) {
    document.getElementById("checkNowBtn").title = "Configure d'abord l'URL de l'ENT dans les réglages";
  }
}

document.getElementById("checkNowBtn").addEventListener("click", async () => {
  const btn = document.getElementById("checkNowBtn");
  btn.textContent = "Vérification...";
  btn.disabled = true;
  await chrome.runtime.sendMessage({ type: "CHECK_NOW" });
  await refreshUI();
  btn.textContent = "Vérifier maintenant";
  btn.disabled = false;
});

document.getElementById("stopBtn").addEventListener("click", async () => {
  const config = await chrome.storage.local.get(["stoppedUntilDate"]);
  const stoppedToday = config.stoppedUntilDate === todayStr();
  if (stoppedToday) {
    await chrome.storage.local.set({ stoppedUntilDate: null });
  } else {
    await chrome.storage.local.set({ stoppedUntilDate: todayStr() });
  }
  await refreshUI();
});

document.getElementById("optionsBtn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

refreshUI();
