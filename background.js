// ADP Sign-in Helper - background service worker (Manifest V3)
//
// Persistent monitor. Rules:
//  - Any HTTP 431 from an adp.com host fires TIER 1 on that tab only:
//    delete bot-detection / telemetry / branding cookies (no session lives
//    in them), then reload that tab. Other tabs are never touched.
//  - The popup button fires TIER 2: delete every adp.com cookie in that tab's
//    cookie store and reload that tab. Only on user click.
//  - Touch ID records are installed by content.js when the sign-in screen
//    loads (online.adp.com/signin/*). They are captured from a sign-in screen
//    only when the user clicks the popup button.
// Records are kept in chrome.storage.sync (follows the Google account), with
// chrome.storage.local as fallback.

const TIER1_COOLDOWN_MS = 30 * 1000;
const lastTier1ByTab = new Map();

// Cookie names that carry no session: Akamai Bot Manager, F5 Shape (random
// 8-char names), Dynatrace RUM, Pendo, ADP branding/landing, OneTrust consent.
const TIER1 = [
  /^_abck$/, /^bm_/, /^ak_bmsc$/, /^akavpau_/, /^bm_sz$/, /^bm_sv$/, /^bm_mi$/,
  /^dtCookie$/, /^dtPC$/, /^dtSa$/, /^dtLatC$/, /^rxVisitor$/, /^rxvt$/, /^MTRUID$/,
  /^_pendo/, /^PMData$/, /^adp\.aim\.branding$/, /^OptanonConsent$/, /^OptanonAlertBoxClosed$/,
  /^cf_clearance$/, /^_cs_/, /^_evga_/, /^_rdt_uuid$/, /^invoca_session$/, /^tmx_guid$/,
  /^[A-Za-z0-9]{8}$/ // Shape-style opaque names such as k8Ksj346
];
const isTier1 = (name) => TIER1.some((re) => re.test(name));

// ---------- records ----------
const nonEmpty = (r) => !!(r && Object.keys(r.userData || {}).length);

async function getRecords() {
  try { const { records } = await chrome.storage.sync.get("records"); if (nonEmpty(records)) return records; } catch (e) {}
  const { records } = await chrome.storage.local.get("records");
  return nonEmpty(records) ? records : null;
}

async function setRecords(records) {
  const payload = { records, updatedAt: Date.now() };
  try { await chrome.storage.sync.set(payload); } catch (e) { console.warn("sync unavailable, using local", e); }
  await chrome.storage.local.set(payload);
}

async function log(event, detail) {
  const { activity = [] } = await chrome.storage.local.get("activity");
  activity.unshift({ at: Date.now(), event, detail });
  await chrome.storage.local.set({ activity: activity.slice(0, 20) });
}

chrome.runtime.onInstalled.addListener(async () => {
  if (!(await getRecords())) {
    try {
      const seed = await (await fetch(chrome.runtime.getURL("seed.json"))).json();
      if (nonEmpty(seed)) { await setRecords(seed); await log("seeded", `${Object.keys(seed.userData).length} account(s)`); }
    } catch (e) {}
  }
});

// ---------- cookies ----------
async function storeIdForTab(tabId) {
  const stores = await chrome.cookies.getAllCookieStores();
  const s = stores.find((st) => st.tabIds.includes(tabId));
  return s ? s.id : undefined;
}

async function clearCookies(storeId, filter) {
  const cookies = await chrome.cookies.getAll({ domain: "adp.com", storeId });
  let removed = 0, bytes = 0;
  for (const c of cookies) {
    if (!filter(c)) continue;
    const host = c.domain.replace(/^\./, "");
    const url = `${c.secure ? "https" : "http"}://${host}${c.path || "/"}`;
    try { await chrome.cookies.remove({ url, name: c.name, storeId: c.storeId }); removed++; bytes += c.name.length + c.value.length + 3; } catch (e) {}
  }
  return { removed, bytes };
}

async function tier1(tabId, reason) {
  const now = Date.now();
  if (now - (lastTier1ByTab.get(tabId) || 0) < TIER1_COOLDOWN_MS) return;
  lastTier1ByTab.set(tabId, now);
  const r = await clearCookies(await storeIdForTab(tabId), (c) => isTier1(c.name));
  await log("tier 1", `${r.removed} telemetry cookies (${r.bytes} B) after ${reason}`);
  try { await chrome.tabs.reload(tabId); } catch (e) {}
}

async function tier2(tabId) {
  const r = await clearCookies(await storeIdForTab(tabId), () => true);
  await log("tier 2", `${r.removed} adp.com cookies (${r.bytes} B) cleared by button`);
  try { await chrome.tabs.reload(tabId); } catch (e) {}
  return r;
}

// Persistent monitor. Cookie overflow shows up two ways on adp.com:
//  - HTTP 431 from the API gateway (seen on /csrf and /api/* at ~8 KB);
//  - HTTP 400 "Bad Request" from the front server for the page or a script
//    itself at a larger size. An app API may answer 400 legitimately, so the
//    400 rule applies only to document and script loads.
const OVERFLOW_TYPES = new Set(["main_frame", "sub_frame", "script", "stylesheet"]);
chrome.webRequest.onCompleted.addListener(
  (d) => {
    if (d.tabId < 0) return;
    const overflow = d.statusCode === 431 || (d.statusCode === 400 && OVERFLOW_TYPES.has(d.type));
    if (!overflow) return;
    const path = d.url.replace(/^https?:\/\//, "").split("?")[0];
    tier1(d.tabId, `${d.statusCode} on ${path}`);
  },
  { urls: ["https://*.adp.com/*"] }
);

// ---------- messages ----------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "getRecords") {
        sendResponse(await getRecords());
      } else if (msg.type === "setRecords") {
        await setRecords(msg.records);
        await log("imported", `${Object.keys(msg.records.userData || {}).length} account(s)`);
        sendResponse({ ok: true });
      } else if (msg.type === "tier2") {
        sendResponse(await tier2(msg.tabId));
      } else if (msg.type === "capture") {
        // Only from a sign-in screen tab, only on user click.
        const page = await chrome.tabs.sendMessage(msg.tabId, { type: "capture" });
        const users = Object.keys(page.userData || {});
        if (!users.length) { sendResponse({ ok: false, error: "This sign-in screen has no Touch ID records." }); return; }
        await setRecords(page);
        await log("captured", `${users.length} account(s) from this profile`);
        sendResponse({ ok: true, users });
      } else if (msg.type === "log") {
        await log(msg.event, msg.detail);
        sendResponse({ ok: true });
      } else if (msg.type === "status") {
        const records = await getRecords();
        const { activity = [] } = await chrome.storage.local.get("activity");
        sendResponse({ users: records ? Object.keys(records.userData) : [], activity });
      } else {
        sendResponse({ error: "unknown message" });
      }
    } catch (e) {
      sendResponse({ error: String(e) });
    }
  })();
  return true;
});
