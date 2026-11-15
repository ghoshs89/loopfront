# Loopfront

A bright, kid-friendly territory game for the Fire HD 10 tablet (and any browser). Leave your land, draw a
loop, come back home and the whole loop becomes yours. Cross someone's trail and they are out; cross your
own and you are out. Pick a buddy, a colour and a name, then play against computer-controlled pals.

The game is a single offline web page (`web/index.html`). `android/` wraps it in a tiny Android app, and a
GitHub Actions workflow builds the APK for you.

## Install on a Fire tablet

1. On the tablet, open this link in the Silk browser:
   `https://github.com/ghoshs89/loopy/releases/latest/download/loopfront.apk`
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

## Notes

Original repository text: "# loopy"
