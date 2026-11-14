# Make CapForge open normally on Mac

This is a one-time setup for the person publishing CapForge. Editors do not need
an Apple developer account or certificates. They download the DMG, drag the app
to Applications, and open it.

**Current status:** the published `dcaf15d` preview is ad-hoc signed and is not
Apple notarized. The new release pipeline requires Developer ID signing and
Apple approval before publishing another release. Adding this pipeline does not
retroactively approve the old download.

## 1. Get the publisher account and certificate

Use an active [Apple Developer Program membership](https://developer.apple.com/programs/enroll/).
For a company account, work with its Account Holder. Apple controls enrollment,
identity verification, membership fees and certificate access; installing Xcode
alone does not grant a distribution identity.

Create a **Developer ID Application** certificate with its private key on your
Mac. Use Xcode's account/certificate management or Apple's certificate portal.
An Apple Development certificate is for a different purpose; Developer ID
Installer is for signed PKG installers, while CapForge ships an app inside a DMG.
Follow [Apple's Developer ID guide](https://developer.apple.com/developer-id/).

In Keychain Access → My Certificates, find your Developer ID Application
identity, expand it and confirm its private key appears. Export that identity as
a password-protected `.p12` file. Save it outside this repository and keep a
secure backup. Exporting a `.cer` alone leaves out the private key and cannot
sign a build.

You also need your 10-character **Team ID** from your developer membership and
an [app-specific password](https://support.apple.com/102654) for the Apple Account
used for notarization. This is separate from your normal Apple Account password.
Never paste these secrets into chat, an issue, a commit, or release notes.

## 2. Connect GitHub securely

Open [CapForge → Settings → Secrets and variables → Actions](https://github.com/MeticulousTransformer/CapForge/settings/secrets/actions).
Add these repository secrets:

| Secret name | Value |
| --- | --- |
| `CAPFORGE_APPLE_CERTIFICATE_P12` | Base64-encoded contents of the exported P12 |
| `CAPFORGE_APPLE_CERTIFICATE_PASSWORD` | The nonempty password chosen when exporting the P12 |
| `CAPFORGE_APPLE_ID` | Apple Account email used for notarization |
| `CAPFORGE_APPLE_APP_PASSWORD` | Its app-specific password |
| `CAPFORGE_APPLE_TEAM_ID` | The certificate's 10-character Team ID |

To copy the P12 as Base64 on your own Mac, replace the example path and run:

```sh
base64 -i "$HOME/Documents/CapForge-signing/DeveloperID.p12" | pbcopy
```

Paste directly into the matching GitHub secret field. Clear the clipboard
afterward. Base64 is only an encoding; treat it like the original private key.
The workflow uses a temporary, password-protected keychain on a GitHub-hosted
runner and deletes it after the build. No keychain or certificate is included in
the downloadable artifacts. See [GitHub's certificate guidance](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications).

## 3. Run the release

Open [Actions → Test and release CapForge](https://github.com/MeticulousTransformer/CapForge/actions/workflows/release.yml),
choose **Run workflow**, and select **kml**. Future pushes use the same setup.

The Mac build signs the universal app with hardened runtime and a secure
timestamp, uploads it to Apple, and waits for **Accepted**. It attaches Apple's
ticket to the app, builds and signs the DMG, then submits and staples the DMG.
Only then does it create the updater ZIPs and final checksums.

Separate Apple Silicon and Intel jobs check the final DMG and both updater ZIPs:
release identity, checksums, signed app, attached ticket and Gatekeeper
acceptance. They also run the packaged installer. Windows runs its own build
and installation checks. The Mac and Windows downloads publish together only
after all required checks pass.

If no Apple secrets exist, CI builds preview artifacts and skips public
publication. If only some secrets exist, it fails with their missing names.
An Apple rejection, expired certificate, timeout or failed Gatekeeper check
also prevents publication. Submission responses and rejection details are in
the separate `apple-notarization-diagnostics` Actions artifact, not release assets.

## Local release build, if needed

After installing the Developer ID identity in your login keychain, create a
notary profile once. The command prompts for credentials securely:

```sh
xcrun notarytool store-credentials CapForgeNotary
```

Then build using your actual identity name from
`security find-identity -v -p codesigning`:

```sh
python scripts/package_release.py --source-only
python scripts/build_macos.py --archive dist/CapForge-0.3.3.zip \
  --sign-identity 'Developer ID Application: Your Name (TEAMID)' \
  --notary-profile CapForgeNotary
```

The optional `--sign-keychain` and `--notary-keychain` flags select a separate
keychain. Omitting the signing and notary options creates an ad-hoc development
preview; it does not produce an approved public Mac release.

## What approval covers, and the final desktop check

Notarization covers the submitted native app and DMG. First setup currently
downloads Python and FFmpeg separately; they are outside that submission.
Their checksums and successful installation are different evidence from Apple
approval. Apple's [custom workflow guidance](https://developer.apple.com/documentation/security/customizing-the-notarization-workflow)
calls for notarizing separately downloaded software too. Distributing signed,
notarized runtime packages remains a separate packaging task.

Before calling the whole installation experience finished, download the new
release through a browser on fresh Intel and Apple Silicon Macs. Drag the app
to Applications and open it without an existing per-app security exception.
Complete setup, start the service, process audio with FFmpeg, and install an
update. Record any desktop prompts. CI execution does not reproduce the full
browser-download and quarantine experience.

The blocking “Apple could not verify” alert should be gone for the approved
native app. A normal first-open confirmation can still appear. Windows
publisher signing and Adobe extension signing are separate; this Mac work does
not change their current preview status.
