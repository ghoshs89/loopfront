# Loopfront

A bright, kid-friendly territory game for Fire tablets, browsers, and a **Windows desktop preview**. Leave your land, draw a
loop, come back home and the whole loop becomes yours. Cross someone's trail and they are out; cross your
own and you are out. Pick a buddy, a colour and a name, then play against computer-controlled pals.

The game is a single offline web page (`web/index.html`). `android/` wraps it in a tiny Android app, and a
GitHub Actions workflow builds the APK for you. `desktop/` wraps that same page in Electron for Windows.

> **Windows preview:** available on the [`windows-desktop` branch](https://github.com/ghoshs89/loopfront/tree/windows-desktop),
> proposed in [draft PR #7](https://github.com/ghoshs89/loopfront/pull/7). Downloads are uploaded only after all preview checks pass.
> It is proposed for review, not a Windows release on `main`. This branch leaves the Android files,
> Android workflow, current APK releases, and download links unchanged. Shared-page desktop hooks
> would become part of Android's bundled page only after a future merge.

## Choose how to play

| Platform | Get the game | Status |
|---|---|---|
| Android / Fire tablet | [Latest APK](https://github.com/ghoshs89/loopfront/releases/latest/download/loopfront.apk) | Existing Android release |
| Windows 10/11 x64 | [Windows preview workflow runs](https://github.com/ghoshs89/loopfront/actions/workflows/windows-preview.yml?query=branch%3Awindows-desktop) | Portable ZIP from a successful run; GitHub sign-in required |
| Edge / Chrome browser | Open `web/index.html` from a downloaded or cloned checkout | Offline page; no installer or server required |

## How to play

- Hold a finger (or the mouse) where you want to go, or switch to a joystick on the start screen (drag anywhere; the character stays visible). On a keyboard, W A S D or the arrow keys point you toward that side of the screen.
- Your land is your safe place. Leave it and you draw a trail; loop back home and everything inside the loop becomes yours.
- Crossing another player's trail takes them out. Crossing your own trail takes you out. Bumping head-on takes out whoever is not standing on their own land (both, if neither is).
- Friendly power-ups appear on the island and fade after a while. Only you can pick them up: **Zoom** (a speed boost), **Bubble** (a safe bubble) and **Freeze** (slows every pal down).
- Coins are earned by playing (land, tags, loops, stars and power-ups) and spent in the **dress-up shop** on hats, trail styles and island looks (snow, candy, space). Every item has a fixed, visible price. There is no real money, no timers and no random items.
- Each day has one small **daily mission** on the start screen (for example "Draw 5 loops"). Finishing it pays 50 coins, and finishing on consecutive days builds a quiet "days in a row" counter. There are no reminders, notifications or countdowns, and missing a day just hides the counter.
- Easy mode gives a bouncy island edge and a few seconds of protection at the start. Earn stars for owning more of the island, tagging pals, playing for two minutes and drawing loops.

## Classic mode

Choose **Classic** instead of **Island** on the start screen (Island is always the starting choice when the
app opens). Classic is a separate, stricter way to play:

- A square board of 56 x 56 tiles with straight walls. Touching a wall ends the round.
- Movement is in four directions only, and turns happen exactly on the squares: press an arrow key or
  W A S D, or swipe (a mouse drag works too). The latest turn you ask for is used at the next square;
  turning straight back is ignored.
- One life, no protection bubble, no power-ups. Pals move the same way.
- You win by owning every single tile (100%); one tile short is not a win.
- Classic keeps its own best score; the Island best is never changed by Classic. The family's Island
  settings (difficulty, hearts) do not apply to Classic, but the break reminder and daily limit do.

## Challenges and buddies

The trophy button on the start screen opens three **challenges**. Each is a small Classic board with a fixed
starting layout, so Retry always gives the same puzzle:

| Challenge | Goal | Pals |
|---|---|---|
| First Rectangle | Close one loop | none |
| Half the Board | Own half the board | 2 |
| Full Board | Own every tile | 2 |

A tick marks a finished challenge. Challenges are practice: they never pay coins, stars or records and do not
count for the daily mission, but the break reminder and daily limit still apply.

Three **buddies** (extra characters, original Loopfront designs) are earned rather than bought, and stay once
earned:

| Buddy | How to earn it |
|---|---|
| Owl | Draw a loop in Classic |
| Dino | Own 25% in Classic |
| Unicorn | Finish the Full Board challenge |

Tapping a locked buddy shows how to earn it (with your progress where it applies).

## Install on a Fire tablet

1. On the tablet, open this link in the Silk browser:
   `https://github.com/ghoshs89/loopfront/releases/latest/download/loopfront.apk`
2. Open the downloaded file. When Fire OS asks, allow "install unknown apps" for Silk.
3. Loopfront appears with your other apps.

Updates: open **Grown-ups** on the start screen, answer the maths question, and tap **Check for updates**.
If a newer version exists, **Download update** opens the new APK; tap it to install over the old one.

## Windows desktop preview

Use a successful workflow run; failed runs contain test reports but no playable download.

1. Sign in to GitHub and open the [Windows preview workflow](https://github.com/ghoshs89/loopfront/actions/workflows/windows-preview.yml?query=branch%3Awindows-desktop).
2. Choose a successful run for `windows-desktop`, then download its **loopfront-windows-x64-preview-N** artifact.
3. Extract the downloaded artifact archive. Inside is `loopfront-windows-x64-v0.1.N.zip` and `SHA256SUMS.txt`.
4. Extract the **entire inner ZIP** to a normal folder, then run **Loopfront.exe**. Keep the supporting files and `resources` folder alongside the executable.

This preview is for **Windows 10/11 x64**. It needs no installation, administrator access, internet
connection, or separately installed browser runtime. Chromium is bundled, so the download is larger
than the Android APK. ARM64 is not a tested target.

Use the mouse, WASD, or arrow keys to steer. **Esc** pauses; **F11** toggles fullscreen. Switching to
another application or minimizing pauses the round; return and click **Keep playing** to resume.
Only one Loopfront instance runs at a time. Closing its window exits the application.

The preview is **unsigned**, so Windows may display an unknown-publisher or SmartScreen warning.
Download only from this repository's workflow and follow your computer's security policies. Do not
disable Windows security protections to run it. Organizations may block unsigned applications.

## Updates and saved progress

- **Windows:** close Loopfront, download a newer successful preview, extract it into a new folder, and launch its executable. Updates are manual; there is no automatic updater or Windows latest-release URL. After updating, the old extracted application folder can be removed.
- Desktop saves live under **`%APPDATA%\Loopfront`**, independent of the extraction folder and version. Keep that directory to retain names, settings, stars, records, coins, shop items, missions and daily usage.
- **Android:** use the existing parent-gated update flow described above. Keep the same signing key for updates.
- **Browser:** saves belong to the browser profile and page origin. Private browsing, clearing browser data, or moving a local HTML file can lose or separate progress.
- Android, browser, and Windows saves are separate local profiles; they do not sync. Progress Reset does not require deleting application files.

## For grown-ups

The **Grown-ups** button (bottom right of the start screen) is protected by a multiplication question and
locks for a minute after three wrong answers. Inside you can:

| Setting | What it does |
|---|---|
| Difficulty | Easy (default): 3 hearts (a mistake costs a heart and sends you home with your land kept), 6 slower pals that never chase you and steer around your trail, a bouncy island edge and 5 seconds of protection at the start. Normal: 2 hearts, more and faster pals that can chase. Hard: one life. |
| Break reminder | After 15, 30 (default) or 45 minutes of actual play (menus, pauses, results and time in the background do not count) a "Time for a stretch!" screen appears between rounds. It is never shown in the middle of a round. |
| Daily limit | Off (default), 30, 60 or 90 minutes of actual play per day. When it is reached, the next Play shows "All done for today!" instead of starting a round (a round in progress is never cut short). A grown-up can tap "15 more minutes" and answer the question. The limit wins over the break reminder. A new day starts fresh. |
| Today's summary | Minutes played, rounds and best score for today, shown at the top of the Grown-ups corner. |
| Battery saver | Draws 30 frames per second instead of 60. Game speed does not change. |
| Check for updates | Android only: uses the internet when tapped. Windows shows its preview version; download Windows updates manually. |
| Reset | Clears all progress: stars, best score, coins and everything in the shop. |

## Privacy and safety

- No ads, purchases, accounts, chat, links or tracking. Other players are computer-controlled.
- Everything is bundled in the app and works with no internet connection.
- Android and Windows wrappers only show their bundled page and block external navigation. The Windows wrapper also blocks network requests, new windows, downloads and permission requests.
- Android requests internet access for the parent-triggered update check. Windows gameplay does not require network access or administrator rights.
- Names, stars, settings and the best score stay on the device or browser profile. A new best score is saved the moment it is reached, even if a round is left early.
- The page itself carries a Content-Security-Policy that blocks all network access from the game code.
- The game loop stops when the app is in the background, paused, or sitting idle on a menu.

## Development and builds

### Android

Push to `main` (changes under `web/`, `android/` or the workflow), or use **Actions > Build APK > Run
workflow**. The workflow builds a signed APK and publishes it as release `vN` (N is the run number, also the
app's version). It needs four repository secrets holding the signing key: `SIGNING_KEYSTORE_B64`,
`SIGNING_STORE_PASSWORD`, `SIGNING_KEY_ALIAS`, `SIGNING_KEY_PASSWORD`. Every build must use the same key,
otherwise Android refuses to install it over the old version.

### Windows development and packaging

Use Node **24** and npm. Windows packaging is supported on Windows x64; the app's game code remains
in `web/index.html`. Desktop dependencies have a separate lockfile so the existing Android tooling
continues to install only the root test dependencies.

```bash
npm ci
npm ci --prefix desktop
npm start --prefix desktop
npm test --prefix desktop
npm run pack:windows --prefix desktop
npm run verify:windows --prefix desktop
```

Packaging writes the ZIP and an unpacked validation copy under `desktop/dist/`. Local builds use
version `0.1.0`; CI uses `0.1.N`, where N is the Windows workflow run number (independent of Android
versions). The verifier checks the Windows executable, wrapper, version and bundled game against source.

The Windows icon is derived from the unchanged Android launcher artwork. Regenerate its SVG and
seven ICO sizes with `npm run icon --prefix desktop` after installing the root Chromium test browser.
EXE icon and version resources are applied, while signing is explicitly disabled for this preview.
The verifier checks the embedded icon and Loopfront product/file-description fields as well.

If the renderer crashes, Loopfront reloads the game once automatically. A second crash, or an
unresponsive window, offers Reload game or Close Loopfront. Saved progress is retained; the current
round ends. Crash reasons are logged to the process's standard error (visible when launched from a terminal).

For packaged-app tests, set `LOOPFRONT_TEST_EXE` to the absolute path of the extracted `Loopfront.exe`
before running the desktop test command. Tests use temporary profiles. `LOOPFRONT_USER_DATA_DIR`
is an optional absolute profile-directory override for isolated testing; leave it unset for normal play.

## Play in a browser

Download and extract a checkout, or clone this repository. Double-click `web/index.html` and open it
in Edge or Chrome. No Node, npm, local server, or package installation is needed to play. Mouse or
touch steers; WASD and arrow keys point toward their respective screen edges. Use the on-screen Pause
button. F11/Esc instructions above apply specifically to the Windows desktop app.

## Tests

Needs Node 24. The shared game page has no dependencies; browser test tooling is development-only.
The Windows application bundles Electron as its runtime.

```bash
npm ci                       # locked dev dependencies (Playwright)
npm run test:harness         # headless simulation: rules, steering, scoring, timing, storage, offline scan
npx playwright install chromium
npm run test:browser         # real-browser checks: keyboard, HUD layout at many sizes, touch, no network
```

The existing Android CI runs both on relevant pull requests and before APK releases. **Its workflow
is unchanged by this branch.** The separate [Windows preview workflow](.github/workflows/windows-preview.yml)
runs shared web checks, packages on Windows, verifies the extracted ZIP and tests that packaged app.
It has read-only repository permissions and uploads Actions artifacts only: it cannot publish a
GitHub Release or replace an APK. Browser/harness results are not a substitute for a real Fire tablet;
Windows runner tests are also distinguished from a manual check on a personal Windows computer.

## Project layout

| Path | What it is |
|---|---|
| `web/index.html` | The whole game: one offline page, no libraries or assets. |
| `android/` | Minimal Android app (a full-screen WebView) that bundles `web/` and talks to the page through a small bridge. |
| `.github/workflows/build-apk.yml` | Validates (web and Android), then signs and publishes the APK. |
| `tests/harness.js` | Headless tests (needs Node). |
| `tests/browser/` | Playwright browser tests (dev-only). |
| `desktop/` | Electron wrapper, separate dependency lockfile, portable ZIP configuration and package verifier. |
| `desktop/tests/` | Electron security, controls, lifecycle and persistence checks. |
| `.github/workflows/windows-preview.yml` | Read-only Windows preview checks and downloadable artifacts. |

## Troubleshooting and limitations

- **No Windows download:** sign in, select a successful `windows-desktop` run, and scroll to Artifacts. A failed or still-running job does not publish a playable artifact. Preview artifacts expire after 30 days; use a newer successful run or ask a maintainer for a rebuild.
- **Missing DLL/resources error:** extract the entire inner game ZIP. Do not run only the EXE copied out of the archive.
- **Unsigned-app warning:** this is an unsigned preview. Verify its repository source and follow your Windows security policy; signing and an installer are future work.
- **Progress seems missing:** use the same Windows account and keep `%APPDATA%\Loopfront`. Browser and Android progress do not appear in the Windows app.
- **Game paused after switching windows:** intentional; click Keep playing. Esc pauses but does not automatically resume.
- **Large download:** Electron includes Chromium for offline operation. There are no automatic Windows updates, cloud saves, installer, or Microsoft Store package.

## Keep the Android signing key safe

Android only installs an update over an existing app if both are signed with the same key. The key lives in
the repository's Actions secrets and in a private backup outside the repository. If it is ever lost, the
app must be uninstalled once before a build signed with a new key can be installed.
