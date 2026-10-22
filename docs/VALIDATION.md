# v0.3.1 validation

22 October 2026 connection fix:

- **160 automated tests passed:** 50 backend, 105 combined AE/panel tests,
  and 5 installer tests.
- The installed Windows service accepts authenticated requests with both CEP
  origins (`file://` and `null`), returning the matching CORS origin header.
- Live checks returned 200 for Adobe's preflight, 401 for missing authorization,
  and 403 for a web origin even with a valid installation token.
- The installed backend was backed up and patched, and its service restarted.
  Reconnection in the open AE panel still needs user confirmation; these checks
  do not establish transcription quality or animation playback.

8 October 2026 validation:

Passed on the Windows development checkout:

- **157 automated tests:** 47 backend, 80 AE-engine tests, 25 panel-data/
  title/bridge tests, and 5 installer deployment/update/rollback tests.
- Engine bootstrap: source and installed paths, missing native JSON, unrelated
  `$.fileName`, a UTF-8 BOM, platform path escaping, initialization reuse and retry
  passed. No user path is evaluated as code.
- Service startup: authenticated reuse, a foreign occupied port, simultaneous
  startup recovery and refusal to redirect the local token passed.
- User installation repair: v0.3.1 deployed to the owned installation and both
  levels of the Desktop extraction. The installed launcher reused the existing
  service and authenticated `/providers` returned 200; keys, runtime and exports
  were preserved. The live installed-engine initialization returned `ok: true`
  from AE 26.5. Panel appearance and the complete workflow after restarting AE
  remain unverified; engine initialization does not establish animation playback.
- AI onboarding: registry/key-field coverage, allowlisted external links,
  browser isolation, and a simulated DOM/service flow for key clearing,
  Show/Hide, Azure region saving and provider selection passed. No provider
  account was signed into and no paid API was called.
- Updated installer: native Tk geometry checks passed at simulated 96, 120,
  144 and 192 DPI, with a non-resizable 580 × 640 design scaled for display
  density, fitting content and compact
  buttons. This checks layout dimensions, not a visual appearance review.
- The latest violet theme and AI guide have source/behavior checks. Browser
  inspection below describes the earlier UI; it does not validate this refresh.
- Native bootstrap: PowerShell syntax, Windows argument quoting and destination
  bounds checks passed. Mac shell syntax checked; Mac execution is unverified.
- Windows installation into isolated workspace folders: official pinned uv
  download was checksum-verified, private Python and Tk prepared, service
  packages installed and CEP files deployed with system Python removed from the
  test process's PATH. Adobe settings were not changed for this test.
- Installed runtime: real audio conversion using the private bundled ffmpeg
  produced a 16 kHz mono WAV. No cloud-provider calls were made. Native
  `CapForge Setup.exe` compiled successfully; visual GUI validation remains open.
- Rename compatibility: old installation markers and saved looks are accepted;
  API configuration and the private runtime survive updating to CapForge.
- Live local service: health, token authentication, denial of unrelated web
  origins, provider listing and regrouping that preserves Georgian word timings.
- Browser UI: live caption preview, word editing, style selection/search/category
  filtering, aspect-ratio switching, quick-start dialog and no horizontal overflow
  at a 440-pixel viewport. The desktop layout was also visually inspected.
- Browser workflow with a **simulated** AE host/provider: media selection →
  transcription result → Georgian word edit → Soft Rise selection → generation
  payload with RGB colors, plus grouping requests. This does not establish actual
  AE generation or cloud-provider quality.
- Restored-control check: every original visual setting has a studio control.
  Browser interactions verified Slide In's angle/dial/keyboard shortcuts,
  distance, duration, dolly and easing; font family/style; shadow/outline values;
  boundary tracking; unlimited wrapping; shuffle variants/fonts/seed, and RGB
  values in the simulated generation payload. No browser console errors.
- Preview shuffle is generated from the existing AE source. Tests compare
  multiple fixed-seed caption patterns against the engine. Slide timing tests
  cover preroll, direction, dolly and separate temporal ease influences.
- Browser transcription requests include custom model, speaker identification,
  minimum words and durations. Audio-only preparation uses `/extract_audio`.
- Background opacity: engine and canvas tests verify transparent, partial and
  solid boxes while word opacity/timing stays unchanged. Old saved looks default
  to 100%; saving/loading and the AE settings payload preserve explicit 0%.
- Source installer: preserves existing credentials, exports and environment;
  refuses unrelated destinations; restores a previous install after an injected
  failure. Does not copy the source checkout's credentials or nested environment.
- Distribution: explicit file allowlist, four JSON fixtures, no keys/tokens,
  virtual environments, model files, exports or presentation dependencies.

Not validated here: installation/display inside actual AE, real AE animation
playback, native installer GUI appearance, clean-machine macOS installation,
paid-provider transcription, signing/Gatekeeper and the full advertised AE version
range. Complete `docs/RELEASE.md` before selling this build as a supported release.
