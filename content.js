// ADP Sign-in Helper - content script, sign-in screen only
// (manifest matches https://online.adp.com/signin/*). Runs at document_start,
// before ADP's sign-in app reads localStorage.
//
// Install: fills in any Touch ID passkey records missing from this profile
// (userData / userAccountData / device_id) from the account-synced copy.
// Capture: only when asked by the popup button, returns this profile's records.
// Nothing here touches cookies or navigates.

const hasCreds = (e) => !!(e && e.fido2 && Array.isArray(e.fido2.localCredentials) && e.fido2.localCredentials.length);
const parse = (k) => { try { return JSON.parse(localStorage.getItem(k) || "{}"); } catch (e) { return {}; } };

function install(records) {
  if (!records || !Object.keys(records.userData || {}).length) return 0;
  const ud = parse("userData"), ua = parse("userAccountData");
  let changed = 0;
  for (const [u, e] of Object.entries(records.userData)) {
    if (hasCreds(e) && !hasCreds(ud[u])) { ud[u] = e; changed++; }
  }
  for (const [u, id] of Object.entries(records.userAccountData || {})) {
    if (!ua[u]) { ua[u] = id; changed++; }
  }
  if (records.device_id && !localStorage.getItem("device_id")) { localStorage.setItem("device_id", records.device_id); changed++; }
  if (changed) {
    localStorage.setItem("userData", JSON.stringify(ud));
    localStorage.setItem("userAccountData", JSON.stringify(ua));
  }
  return changed;
}

chrome.runtime.sendMessage({ type: "getRecords" }).then((records) => {
  const n = install(records);
  if (n) chrome.runtime.sendMessage({ type: "log", event: "installed", detail: `${n} field(s) on sign-in screen` }).catch(() => {});
}).catch(() => {});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "capture") {
    const ud = parse("userData");
    sendResponse({
      userData: Object.fromEntries(Object.entries(ud).filter(([, e]) => hasCreds(e))),
      userAccountData: parse("userAccountData"),
      device_id: localStorage.getItem("device_id")
    });
    return true;
  }
});
