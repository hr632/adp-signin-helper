const $ = (id) => document.getElementById(id);
function msg(text, alert) { const m = $("msg"); m.textContent = text || ""; m.className = alert ? "alert" : ""; }

function row(left, right) {
  const d = document.createElement("div"); d.className = "row";
  const a = document.createElement("span"); a.textContent = left;
  const b = document.createElement("span"); b.textContent = right;
  d.append(a, b);
  return d;
}

function fmt(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

async function render() {
  const records = await chrome.runtime.sendMessage({ type: "getRecords" });
  const s = await chrome.runtime.sendMessage({ type: "status" });
  const acc = $("accounts"); acc.textContent = "";
  if (!records) {
    const e = document.createElement("span"); e.className = "empty";
    e.textContent = "None. Open the ADP sign-in screen in a profile where Touch ID works and use the popup to save them.";
    acc.appendChild(e);
  } else {
    for (const [u, e] of Object.entries(records.userData || {})) {
      const n = ((e && e.fido2 && e.fido2.localCredentials) || []).length;
      acc.appendChild(row(u, `${n} passkey${n === 1 ? "" : "s"}`));
    }
    acc.appendChild(row("Device ID", records.device_id ? records.device_id.slice(0, 8) + "…" : "missing"));
  }
  const act = $("activity"); act.textContent = "";
  if (!s.activity || !s.activity.length) {
    const e = document.createElement("span"); e.className = "empty"; e.textContent = "Nothing yet"; act.appendChild(e);
  } else {
    for (const a of s.activity) {
      const d = document.createElement("div"); d.className = "act";
      const t = document.createElement("time"); t.textContent = fmt(a.at);
      const x = document.createElement("span"); x.textContent = `${a.event}: ${a.detail}`;
      d.append(t, x); act.appendChild(d);
    }
  }
  fetch(chrome.runtime.getURL("seed.json")).then((r) => r.json()).then((seed) => {
    if (seed && seed.userData && Object.keys(seed.userData).length) $("reset").hidden = false;
  }).catch(() => {});
}

$("export").addEventListener("click", async () => {
  const records = await chrome.runtime.sendMessage({ type: "getRecords" });
  const s = JSON.stringify(records || {});
  const ta = $("json"); ta.value = s; ta.classList.add("open");
  try { await navigator.clipboard.writeText(s); msg("Copied to clipboard and shown below."); } catch (e) { msg("Shown below."); }
});

$("import").addEventListener("click", async () => {
  const ta = $("json");
  if (!ta.classList.contains("open") || !ta.value.trim()) { ta.classList.add("open"); ta.focus(); msg("Paste the exported text, then press Import again."); return; }
  try {
    const r = JSON.parse(ta.value);
    if (!r.userData) throw new Error("missing userData");
    await chrome.runtime.sendMessage({ type: "setRecords", records: r });
    msg("Imported."); ta.classList.remove("open"); render();
  } catch (e) { msg("Invalid JSON: " + e.message, true); }
});

$("reset").addEventListener("click", async () => {
  const seed = await (await fetch(chrome.runtime.getURL("seed.json"))).json();
  await chrome.runtime.sendMessage({ type: "setRecords", records: seed });
  msg("Reset to seed records."); render();
});

render();
