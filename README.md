# ADP Sign-in Helper

A small Chrome extension for two ADP sign-in problems. Everything it does stays inside your own Chrome. It never sends anything anywhere.

1. **The endless sign-in spinner.** ADP's sign-in page spins forever once the cookies ADP has set on adp.com outgrow what ADP's servers accept. The extension notices the rejection and trims the cookies that caused it.
2. **Touch ID working in only one Chrome profile.** ADP offers Touch ID only in the profile where you enrolled it. The extension carries your own enrollment record to your other profiles and incognito windows, through your Google account.

## Install

**Chrome Web Store (recommended, updates automatically).**
Open the listing and click **Add to Chrome**:

https://chromewebstore.google.com/detail/oajdlbmpnekfidpicmhmhoodbjjpobhp

The listing is unlisted, so it will not show up in store search; use the link. If the link shows "item not found", the store review is still in progress; use one of the two options below meanwhile.

**Release zip (no developer mode nag, no updates).**
Download `adp-signin-helper-webstore.zip` from the latest release, unzip it somewhere permanent, then follow the unpacked steps below.

**Load unpacked (from this repository).**
1. Clone or download this repository to a permanent folder (deleting the folder disables the extension).
2. Chrome: `chrome://extensions`, turn on **Developer mode** (top right), **Load unpacked**, choose the folder.
3. Chrome shows a "Disable developer mode extensions" notice at startup. Dismiss it; that is normal for an unpacked extension.

**After any install:** open the extension's card in `chrome://extensions`, click **Details**, and turn on **Allow in Incognito**. Without it, incognito windows get nothing.

## First use (Touch ID)

1. Open the Chrome profile where ADP Touch ID already works and go to the ADP sign-in screen (online.adp.com/signin, which is where workforcenow.adp.com sends you).
2. Click the extension icon, then **Save Touch ID records from this screen**. It lists the user IDs it saved to your Google account.
3. In any other profile or an incognito window, open the ADP sign-in screen as usual. Touch ID is offered after the user ID. Nothing to click.

Chrome sync must be on in each profile for the record to arrive; otherwise it stays in the profile where you saved it.

## How it behaves

- **Monitor, always on.** Any HTTP 431 from an adp.com host, or an HTTP 400 on a page or script load there, fires tier 1 on that tab only: bot-detection, telemetry and branding cookies are deleted (no sign-in depends on them) and that one tab reloads. Other tabs are never touched. At most once per 30 seconds per tab.
- **Full clear, on your click.** The popup's **Clear all ADP cookies and reload** deletes every adp.com cookie in that window and reloads the tab. It signs you out of other ADP products open in the same window, so it never runs on its own.
- **Touch ID install, sign-in screen only.** The content script runs only on `online.adp.com/signin/*` and writes the record into the profile if it is missing. No other page, no cookies, no navigation.
- **Capture, on your click only.** **Save Touch ID records from this screen** reads the record from a sign-in screen where Touch ID already works and keeps it in `chrome.storage.sync`.
- **Details and activity** in the popup shows the saved accounts, a log of what the extension did, and export/import of the record as text.

## Why these fixes work

**The spinner.** ADP's sign-in page is a web app that calls ADP's own servers before it can draw the form. Those servers reject any request whose cookie header is too large (HTTP 431 from the API gateway, or a 400 "Bad Request" from the front server at larger sizes). ADP sets many cookies on adp.com (bot detection, monitoring, session tokens for each product you use), and sessions that time out or are closed without logging out leave theirs behind. Once the pile crosses the limit, every call fails and the page spins forever instead of showing an error. Logging out, a private window, or clearing adp.com cookies gets you under the limit, which is why those have always "fixed" it.

**Touch ID.** When you enrolled Touch ID, ADP's page saved a small record in that profile's local storage for online.adp.com: your user ID, the ID of the passkey it created, an ADP account ID, and a device ID. On every later sign-in the page looks only at that local record to decide whether to offer Touch ID; it never asks the browser or the keychain whether a passkey exists. So a second profile, an incognito window, or another Mac, even one where iCloud Keychain already synced the passkey, never gets the Touch ID step. Restoring the record before the page starts is enough: the page then asks for that passkey and the keychain answers.

## What it never does

- It never sees or stores your password, your fingerprint, or your passkey's private key. The key stays in your keychain. The record is a set of identifiers that cannot sign anyone in on their own.
- It cannot enroll Touch ID for you. ADP's "Add a passkey" page is currently broken in Chrome and Safari, so you need one profile where Touch ID already works. If you have none, only the spinner fix applies.
- It shares nothing between people. Records live in your own Google account; each person saves their own.
- It contacts no server and touches no site other than adp.com. It opens no tabs and navigates nowhere.
- It deletes no session cookies without your click.

## Permissions

| Permission | Used for |
|---|---|
| cookies on adp.com | deleting the cookies that cause the spinner |
| webRequest on adp.com | noticing the 431 or 400 reply; observation only |
| storage | keeping your record in Chrome sync |
| tabs | knowing whether the popup's actions apply to the current tab, and reloading the one tab that hit the rejection |

## Files

`manifest.json`, `background.js` (monitor, cookie tiers, messages), `content.js` (sign-in screen only), `popup.html/js`, `options.html/js` (details and activity), `seed.json` (empty on purpose), `icons/`.

MIT license.
