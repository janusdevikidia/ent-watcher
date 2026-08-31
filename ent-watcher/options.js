const fields = ["entUrl", "keyword", "matchMode", "ntfyServer", "ntfyTopic", "intervalMin"];
const DEFAULT_KEYWORD = "n'est pas publié par l'établissement";

async function load() {
  const config = await chrome.storage.local.get(fields);
  document.getElementById("entUrl").value = config.entUrl || "";
  document.getElementById("keyword").value = config.keyword || DEFAULT_KEYWORD;
  document.getElementById("ntfyServer").value = config.ntfyServer || "https://ntfy.sh";
  document.getElementById("ntfyTopic").value = config.ntfyTopic || "";
  document.getElementById("intervalMin").value = config.intervalMin || 5;
  const mode = config.matchMode || "absent";
  document.querySelector(`input[name="matchMode"][value="${mode}"]`).checked = true;
}

document.getElementById("saveBtn").addEventListener("click", async () => {
  const data = {
    entUrl: document.getElementById("entUrl").value.trim(),
    keyword: document.getElementById("keyword").value.trim() || DEFAULT_KEYWORD,
    matchMode: document.querySelector('input[name="matchMode"]:checked').value,
    ntfyServer: document.getElementById("ntfyServer").value.trim() || "https://ntfy.sh",
    ntfyTopic: document.getElementById("ntfyTopic").value.trim(),
    intervalMin: Math.max(1, parseInt(document.getElementById("intervalMin").value, 10) || 5)
  };
  await chrome.storage.local.set(data);
  await chrome.runtime.sendMessage({ type: "RELOAD_ALARM" });

  const msg = document.getElementById("savedMsg");
  msg.style.opacity = 1;
  setTimeout(() => (msg.style.opacity = 0), 1500);
});

load();
