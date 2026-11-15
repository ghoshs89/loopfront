# Loopfront

A bright, kid-friendly territory game for the Fire HD 10 tablet (and any browser). Leave your land, draw a
loop, come back home and the whole loop becomes yours. Cross someone's trail and they are out; cross your
own and you are out. Pick a buddy, a colour and a name, then play against computer-controlled pals.

The game is a single offline web page (`web/index.html`). `android/` wraps it in a tiny Android app, and a
GitHub Actions workflow builds the APK for you.

## How to play

- Hold a finger (or the mouse) where you want to go. On a keyboard, W A S D or the arrow keys point you toward that side of the screen.
- Your land is your safe place. Leave it and you draw a trail; loop back home and everything inside the loop becomes yours.
- Crossing another player's trail takes them out. Crossing your own trail takes you out. Bumping head-on takes out whoever is not standing on their own land (both, if neither is).
- Easy mode gives a bouncy island edge and a few seconds of protection at the start. Earn stars for owning more of the island, tagging pals, playing for two minutes and drawing loops.

## Install on a Fire tablet

1. On the tablet, open this link in the Silk browser:
   `https://github.com/ghoshs89/loopfront/releases/latest/download/loopfront.apk`
2. Open the downloaded file. When Fire OS asks, allow "install unknown apps" for Silk.
3. Loopfront appears with your other apps.

Updates: open **Grown-ups** on the start screen, answer the maths question, and tap **Check for updates**.
If a newer version exists, **Download update** opens the new APK; tap it to install over the old one.

## For grown-ups

The **Grown-ups** button (bottom right of the start screen) is protected by a multiplication question and
locks for a minute after three wrong answers. Inside you can:

| Setting | What it does |
|---|---|
| Difficulty | Easy (default): 6 slower pals that never chase you, a bouncy island edge and 5 seconds of protection at the start. Normal and Hard bring more and faster pals that can chase. |
| Break reminder | After 15, 30 (default) or 45 minutes of play a "Time for a stretch!" screen appears between rounds. It is never shown in the middle of a round. |
| Battery saver | Draws 30 frames per second instead of 60. Game speed does not change. |
| Check for updates | The only feature that uses the internet. It runs only when you tap it. |
| Reset | Clears stars and best score. |

## Privacy and safety

- No ads, purchases, accounts, chat, links or tracking. Other players are computer-controlled.
- Everything is bundled in the app and works with no internet connection.
- The app can only show its own bundled page; any attempt to open another address is blocked.
- The only permission is internet access, used by the parent-triggered update check.
- Names, stars and settings stay on the tablet.
- The game loop stops when the app is in the background, paused, or sitting idle on a menu.

## Build

Push to `main` (changes under `web/`, `android/` or the workflow), or use **Actions > Build APK > Run
workflow**. The workflow builds a signed APK and publishes it as release `vN` (N is the run number, also the
app's version). It needs four repository secrets holding the signing key: `SIGNING_KEYSTORE_B64`,
`SIGNING_STORE_PASSWORD`, `SIGNING_KEY_ALIAS`, `SIGNING_KEY_PASSWORD`. Every build must use the same key,
otherwise Android refuses to install it over the old version.

## Play in a browser

Open `web/index.html`. Mouse or touch to steer, or W A S D / arrow keys (each key points you toward that
side of the screen).

## Tests

`node tests/harness.js web/index.html` runs a headless simulation of the rules, steering, kid settings,
grown-ups gate, break reminder, update panel, battery behaviour and offline/safety scan.

## Project layout

| Path | What it is |
|---|---|
| `web/index.html` | The whole game: one offline page, no libraries or assets. |
| `android/` | Minimal Android app (a full-screen WebView) that bundles `web/` and talks to the page through a small bridge. |
| `.github/workflows/build-apk.yml` | Builds, signs and publishes the APK. |
| `tests/harness.js` | Headless tests (needs Node). |

## Keep the signing key safe

Android only installs an update over an existing app if both are signed with the same key. The key lives in
the repository's Actions secrets and in a private backup outside the repository. If it is ever lost, the
app must be uninstalled once before a build signed with a new key can be installed.
