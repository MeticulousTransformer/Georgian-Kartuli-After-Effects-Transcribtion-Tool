# Release candidate → commercial distribution

This implementation is **v0.3.1, an unsigned release candidate**. The polished
interface and guided source installer are usable, but a ZIP is not a signed,
fully validated commercial release.

Create the clean source package:

```text
python scripts/package_release.py
```

The allowlist excludes `.env`, tokens, exports, models, `.venv`, Git history,
presentation build folders and other local artifacts. The ZIP includes the
offline design demo, guided installers, caption engine, backend, fixtures and
agent documentation. Runtime updates preserve keys and exports.

Before selling:

- Sign the CEP extension using Adobe's signing workflow and ship an installer
  that does not enable PlayerDebugMode. This preview setting permits **all**
  unsigned Adobe extensions for that user, not just this panel.
- Test installation and restart on clean Windows and macOS systems with each
  AE version advertised. Font enumeration is optional on older AE; users can
  type a PostScript font name. The manifest range is not proof of compatibility.
- Validate cloud Georgian transcription and real AE playback on a 10–20 second
  clip. Check all title styles, portraits, multi-line captions and font weights.
- Verify macOS `.command` launch permissions/Gatekeeper behavior in the final
  downloaded distribution. The launchers automatically prepare the runtime;
  validate this flow on clean Mac and Windows systems, including download failures.
- Sign a final native installer. The preview uses `.cmd`/`.command` launchers
  that download a pinned, SHA-256-verified uv distribution, then obtain a private
  Python runtime with no system PATH changes. Audio support comes from the
  `imageio-ffmpeg` wheel. Document these third-party dependencies and their licenses.
- Publish accurate supported-provider/model and AE compatibility information.
  Do not claim all providers have equal Georgian accuracy.
- Keep credentials local, document cloud audio processing, and consider the
  operating system's credential vault before broad commercial release.
- Provide a support route, version policy, pricing and a real recorded demo.
  None are invented by this code change. The existing MIT license remains.

Technical references: [Adobe CEP resources](https://github.com/Adobe-CEP/CEP-Resources)
and [Adobe CEP 12 cookbook](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/Documentation/CEP%2012%20HTML%20Extension%20Cookbook.md).
