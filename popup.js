const $ = (id) => document.getElementById(id);
const SIGNIN = /^https:\/\/online\.adp\.com\/signin\//;

function msg(text, alert) { const m = $("msg"); m.textContent = text || ""; m.className = alert ? "alert" : ""; }

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refresh() {
  const tab = await activeTab();
  const s = await chrome.runtime.sendMessage({ type: "status" });
  $("status").textContent = s.users.length ? `Touch ID ready for ${s.users.length} account${s.users.length === 1 ? "" : "s"}` : "No Touch ID records saved";
  const onSignin = !!(tab && SIGNIN.test(tab.url || ""));
  $("capture").disabled = !onSignin;
  $("capHint").textContent = onSignin ? "Reads this profile's records and keeps them in your Google account." : "Open the ADP sign-in screen in this tab first.";
  $("wipe").disabled = !(tab && /^https:\/\/[^/]*adp\.com\//.test(tab.url || ""));
}

$("wipe").addEventListener("click", async () => {
  const tab = await activeTab();
  $("wipe").disabled = true;
  msg("Clearing adp.com cookies.");
  const r = await chrome.runtime.sendMessage({ type: "tier2", tabId: tab.id });
  msg(r.error ? r.error : `${r.removed} cookies cleared. Tab reloaded.`, !!r.error);
  setTimeout(() => window.close(), 1200);
});

$("capture").addEventListener("click", async () => {
  const tab = await activeTab();
  msg("Reading records from this screen.");
  const r = await chrome.runtime.sendMessage({ type: "capture", tabId: tab.id });
  msg(r.ok ? `Saved: ${r.users.join(", ")}` : r.error, !r.ok);
  refresh();
});

$("details").addEventListener("click", () => chrome.runtime.openOptionsPage());

refresh();
