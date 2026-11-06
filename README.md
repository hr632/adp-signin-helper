# ADP Sign-in Helper

A small Chrome extension for two ADP sign-in problems. Everything it does stays inside your own Chrome. It never sends anything anywhere.

## What it does

1. **Fixes the endless sign-in spinner.** The ADP sign-in page (online.adp.com) spins forever when the cookies ADP has set on adp.com grow past what ADP's servers accept (they answer HTTP 431). When the extension sees a 431 from online.adp.com, it deletes the adp.com cookies in that window and reloads the page. At most once a minute per tab. You can also trigger it yourself from the toolbar button.
2. **Carries your Touch ID (passkey) sign-in between your Chrome profiles.** ADP only offers Touch ID in the exact browser profile where you enrolled it. The extension copies the small record ADP keeps for that (your ADP user ID, the passkey's ID, an ADP account ID, a device ID) into your Google account via Chrome sync, and writes it back into any of your Chrome profiles, including incognito windows, when you open online.adp.com. Touch ID then works there too.

## How it works, and what each part is there to fix

**Problem 1: the spinner.** ADP's sign-in page is a web app that calls ADP's own servers before it can draw the form. Those servers reject any request whose cookie header is too large with HTTP 431. ADP sets many cookies on adp.com (bot detection, monitoring, session tokens for each product you use), and sessions that time out or are closed without logging out leave theirs behind. Once the pile crosses the limit, every call fails, and the page shows a spinner forever instead of an error. Logging out, a private window, or clearing adp.com cookies gets you under the limit again, which is why those have always "fixed" it.

*Mechanism:* the extension listens for responses from online.adp.com. The first 431 it sees in a tab makes it delete every cookie under adp.com in that window's cookie store (normal or incognito) and reload the tab. Local storage is left alone, so your Touch ID record survives. A one-minute cooldown per tab stops any loop.

**Problem 2: Touch ID only works in one browser profile.** When you enrolled Touch ID, ADP's page saved a small record in that profile's local storage for online.adp.com: your user ID, the ID of the passkey it created, an ADP account ID, and a device ID. On every later sign-in, the page looks only at that local record to decide whether to offer Touch ID. It never asks the browser or the keychain whether a passkey exists. So a second profile, an incognito window, or another Mac, even one where iCloud Keychain already synced the passkey, never gets the Touch ID step.

*Mechanism:* the extension copies that record once (you press the button in the working profile) into Chrome's synced storage, which Chrome keeps in your Google account. Then, whenever any of your profiles opens an online.adp.com page, a small script runs before ADP's app starts and writes the record back if it is missing. ADP's page then finds the record, asks the browser for that passkey, and Touch ID answers using the key already in your keychain. The one-click button does the same thing from any tab by opening online.adp.com briefly in a hidden background tab of the same window, writing the record, closing it, and sending you to the sign-in page.

## What it does not do

- It does not know, read, or store your password, your fingerprint, or your passkey's private key. The key stays in your Mac's keychain. The record it copies is a set of identifiers that cannot sign you in on their own.
- It does not create a passkey or enroll Touch ID for you. ADP's "Add a passkey" page is currently broken in Chrome and Safari. You need one Chrome profile where Touch ID already works to copy from. If you have none, only the spinner fix applies to you.
- It does not share anything between people. Records go to your own Google account only. Each coworker installs it and saves their own records.
- It does not talk to any server. Its only network activity is opening online.adp.com in your own browser.
- It does not touch any site other than adp.com addresses.
- It does not run when Chrome sync is off; records then stay in the one profile where you saved them.

## Install (about 2 minutes)

1. Copy this folder somewhere permanent (deleting the folder disables the extension).
2. Chrome: `chrome://extensions`, turn on **Developer mode** (top right), **Load unpacked**, choose the folder.
3. On the extension's card click **Details**, turn on **Allow in Incognito**.
4. Chrome will show a "Disable developer mode extensions" notice at startup. Dismiss it; that is normal for an unpacked extension.

## First use

1. Open the Chrome profile where ADP Touch ID already works.
2. Click the extension icon, open **More**, press **Save this profile's Touch ID records to my account**. It reports the user IDs it saved.
3. From then on, in any of your profiles or an incognito window: click the icon, press **Fix ADP sign-in and enable Touch ID**. It clears the cookies, restores the record, and opens the sign-in page. Touch ID fires after you enter your user ID.

## Permissions it asks for, and why

| Permission | Used for |
|---|---|
| cookies on adp.com | deleting the overgrown cookies that cause the spinner |
| webRequest on online.adp.com | noticing the 431 reply |
| storage | keeping your record in Chrome sync |
| tabs, scripting | opening online.adp.com briefly in the background to read or write the record |

## Files

`manifest.json`, `background.js`, `content.js`, `popup.html/js`, `options.html/js`, `seed.json` (empty on purpose).
