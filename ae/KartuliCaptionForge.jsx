/* Kartuli Caption Forge — dockable After Effects panel.
   Georgian/English word-timed caption animator.

   Install: copy KartuliCaptionForge.jsx AND the lib/ folder into
   Scripts/ScriptUI Panels/ (see README), then Window > KartuliCaptionForge.jsx.
   Requires: local backend running (python backend/app.py). */

#include "lib/json2.js"
#include "lib/http_client.jsx"
#include "lib/text_measure.jsx"
#include "lib/presets.jsx"
#include "lib/layer_builder.jsx"

(function KartuliCaptionForge(thisObj) {

    var SETTINGS_SECTION = "KartuliCaptionForge";

    // ---- persisted state helpers ----
    function loadSetting(key, fallback) {
        try {
            if (app.settings.haveSetting(SETTINGS_SECTION, key)) {
                return app.settings.getSetting(SETTINGS_SECTION, key);
            }
        } catch (e) {}
        return fallback;
    }
    function saveSetting(key, value) {
        try { app.settings.saveSetting(SETTINGS_SECTION, key, String(value)); } catch (e) {}
    }

    // ---- runtime state ----
    var state = {
        mediaPath: "",
        doc: null,                       // last normalized TranscriptDocument
        providerIds: ["elevenlabs", "google_chirp", "openai", "azure_speech",
                      "gladia", "assemblyai", "whisper_cpp", "faster_whisper",
                      "mlx_whisper"],
        providerLabels: ["ElevenLabs Scribe v2", "Google Chirp", "OpenAI whisper-1",
                         "Azure AI Speech", "Gladia (Whisper cloud)", "AssemblyAI",
                         "Local whisper.cpp", "Local faster-whisper",
                         "Local mlx-whisper"]
    };

    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel) ? thisObj
            : new Window("palette", "Kartuli Caption Forge", undefined,
                         { resizeable: true });
        win.orientation = "column";
        win.alignChildren = ["fill", "fill"];
        win.spacing = 0;
        win.margins = 0;

        // scroll viewport: content column + scrollbar (ScriptUI has no
        // native scrolling; the scrollbar shifts content.location.y)
        var scroller = win.add("group");
        scroller.orientation = "row";
        scroller.alignChildren = ["fill", "top"];
        scroller.alignment = ["fill", "fill"];
        scroller.spacing = 2;
        var content = scroller.add("group");
        content.orientation = "column";
        content.alignChildren = ["fill", "top"];
        content.spacing = 6;
        content.margins = 8;
        var sbScroll = scroller.add("scrollbar");
        sbScroll.preferredSize.width = 16;
        sbScroll.alignment = ["right", "fill"];

        var tabs = content.add("tabbedpanel");
        tabs.alignChildren = ["fill", "top"];
        tabs.preferredSize.height = 330;

        // ================= SOURCE TAB =================
        var tSrc = tabs.add("tab", undefined, "Source");
        tSrc.orientation = "column";
        tSrc.alignChildren = ["fill", "top"];

        var gFile = tSrc.add("group");
        gFile.add("statictext", undefined, "Media:");
        var etMedia = gFile.add("edittext", undefined, "");
        etMedia.preferredSize.width = 160;
        var btnBrowse = gFile.add("button", undefined, "Browse…");
        var btnFromComp = gFile.add("button", undefined, "From Comp");

        var gLang = tSrc.add("group");
        gLang.add("statictext", undefined, "Language:");
        var ddLang = gLang.add("dropdownlist", undefined,
            ["Georgian (ka-GE)", "English (en-US)", "Auto-detect"]);
        ddLang.selection = 0;

        var gProv = tSrc.add("group");
        gProv.add("statictext", undefined, "Provider:");
        var ddProv = gProv.add("dropdownlist", undefined, state.providerLabels);
        ddProv.selection = 0;
        ddProv.preferredSize.width = 200;
        var btnScan = gProv.add("button", undefined, "Scan");

        var gBackend = tSrc.add("group");
        gBackend.add("statictext", undefined, "Backend:");
        var etHost = gBackend.add("edittext", undefined, loadSetting("host", "127.0.0.1"));
        etHost.preferredSize.width = 100;
        var etPort = gBackend.add("edittext", undefined, loadSetting("port", "8765"));
        etPort.preferredSize.width = 55;
        var btnHealth = gBackend.add("button", undefined, "Test");

        var gAsr = tSrc.add("panel", undefined, "ASR Options");
        gAsr.orientation = "column";
        gAsr.alignChildren = ["fill", "top"];
        var gModel = gAsr.add("group");
        gModel.add("statictext", undefined, "Model override:");
        var etModel = gModel.add("edittext", undefined, "");
        etModel.preferredSize.width = 160;
        var gKey = gAsr.add("group");
        gKey.add("statictext", undefined, "Keyterms (comma):");
        var etKeyterms = gKey.add("edittext", undefined, "");
        etKeyterms.preferredSize.width = 160;
        var cbDiarize = gAsr.add("checkbox", undefined, "Diarization");

        // ================= GROUPING TAB =================
        var tGrp = tabs.add("tab", undefined, "Grouping");
        tGrp.orientation = "column";
        tGrp.alignChildren = ["left", "top"];

        function numField(parent, label, value, width) {
            var g = parent.add("group");
            g.add("statictext", undefined, label);
            var et = g.add("edittext", undefined, String(value));
            et.preferredSize.width = width || 55;
            return et;
        }
        var etMaxWords = numField(tGrp, "Max words per caption (1-6):", loadSetting("maxWords", "4"));
        var etMaxChars = numField(tGrp, "Max characters:", "42");
        var etPause = numField(tGrp, "Pause break (s):", "0.55");
        var etMinDur = numField(tGrp, "Min caption duration (s):", "0.5");
        var etMaxDur = numField(tGrp, "Max caption duration (s):", "3.5");

        // ================= TYPOGRAPHY TAB =================
        var tType = tabs.add("tab", undefined, "Type");
        tType.orientation = "column";
        tType.alignChildren = ["left", "top"];

        // font pickers: AE 24+ exposes app.fonts; fall back to a text field
        var fontGroups = [];
        try {
            fontGroups = app.fonts.allFonts || [];
        } catch (eFonts) {
            fontGroups = [];
        }
        var etFont = null, ddFamily = null, ddStyle = null;
        function fillStyles(styleIndex) {
            if (!ddFamily || !ddFamily.selection) { return; }
            var fam = fontGroups[ddFamily.selection.index];
            ddStyle.removeAll();
            for (var s = 0; s < fam.length; s++) {
                ddStyle.add("item", fam[s].styleName);
            }
            ddStyle.selection = Math.min(styleIndex || 0, fam.length - 1);
        }
        if (fontGroups.length > 0) {
            var gFam = tType.add("group");
            gFam.add("statictext", undefined, "Font:");
            ddFamily = gFam.add("dropdownlist", undefined, []);
            ddFamily.preferredSize.width = 210;
            var gSty = tType.add("group");
            gSty.add("statictext", undefined, "Style:");
            ddStyle = gSty.add("dropdownlist", undefined, []);
            ddStyle.preferredSize.width = 170;
            for (var fgi = 0; fgi < fontGroups.length; fgi++) {
                ddFamily.add("item", fontGroups[fgi][0].familyName);
            }
            ddFamily.onChange = function () { fillStyles(0); };
            // restore previously used font
            var savedPs = loadSetting("font", "NotoSansGeorgian-Bold");
            var selFam = 0, selSty = 0;
            for (var a = 0; a < fontGroups.length; a++) {
                for (var b = 0; b < fontGroups[a].length; b++) {
                    if (fontGroups[a][b].postScriptName === savedPs) {
                        selFam = a; selSty = b; a = fontGroups.length; break;
                    }
                }
            }
            ddFamily.selection = selFam;   // triggers onChange -> fillStyles(0)
            fillStyles(selSty);
        } else {
            etFont = numField(tType, "Font (PostScript name):",
                loadSetting("font", "NotoSansGeorgian-Bold"), 180);
        }
        function currentFontPS() {
            if (ddFamily && ddFamily.selection && ddStyle && ddStyle.selection) {
                return fontGroups[ddFamily.selection.index]
                    [ddStyle.selection.index].postScriptName;
            }
            return etFont ? etFont.text : "";
        }
        var etFontSize = numField(tType, "Font size:", loadSetting("fontSize", "72"));
        var etTracking = numField(tType, "Tracking:", "0");
        var etLineHeight = numField(tType, "Line height (0 = auto):", "0");
        var etWordSpacing = numField(tType, "Word spacing (px):", loadSetting("wordSpacing", "24"));
        var etWordsPerLine = numField(tType, "Words per line (0 = one line):", loadSetting("wordsPerLine", "0"));
        var etCharsPerLine = numField(tType, "Chars per line (0 = off):", loadSetting("charsPerLine", "0"));
        var cbFauxBold = tType.add("checkbox", undefined, "Faux bold");

        function colorField(parent, label, defaultHex) {
            var g = parent.add("group");
            g.add("statictext", undefined, label);
            var et = g.add("edittext", undefined, defaultHex);
            et.preferredSize.width = 70;
            var btn = g.add("button", undefined, "Pick");
            btn.preferredSize.width = 45;
            btn.onClick = function () {
                var c = $.colorPicker();
                if (c !== -1) {
                    var hex = c.toString(16);
                    while (hex.length < 6) { hex = "0" + hex; }
                    et.text = "#" + hex.toUpperCase();
                }
            };
            return et;
        }
        var etFill = colorField(tType, "Text color:", loadSetting("fillColor", "#FFFFFF"));
        var etHighlight = colorField(tType, "Highlight color:", loadSetting("highlightColor", "#FFD400"));
        var cbShadow = tType.add("checkbox", undefined, "Drop shadow");
        var gStroke = tType.add("group");
        var cbStroke = gStroke.add("checkbox", undefined, "Stroke");
        var etStrokeW = gStroke.add("edittext", undefined, "4");
        etStrokeW.preferredSize.width = 40;
        var etStrokeColor = colorField(tType, "Stroke color:", "#000000");
        var gBox = tType.add("group");
        var cbBox = gBox.add("checkbox", undefined, "Background box");
        var etBoxColor = colorField(tType, "Box color:", "#000000");

        // ================= POSITION TAB =================
        var tPos = tabs.add("tab", undefined, "Position");
        tPos.orientation = "column";
        tPos.alignChildren = ["left", "top"];

        var gAnchor = tPos.add("group");
        gAnchor.add("statictext", undefined, "Anchor:");
        var ddAnchor = gAnchor.add("dropdownlist", undefined,
            ["Bottom center", "Center", "Top center", "Custom X/Y"]);
        ddAnchor.selection = 0;
        var etX = numField(tPos, "Custom X (px):", "960");
        var etY = numField(tPos, "Custom Y (px):", "1600");
        var etVOffset = numField(tPos, "Vertical offset (px):", "0");
        var etSafe = numField(tPos, "Safe margin (px):", "160");
        var gAlign = tPos.add("group");
        gAlign.add("statictext", undefined, "Alignment:");
        var ddAlign = gAlign.add("dropdownlist", undefined, ["Center", "Left", "Right"]);
        ddAlign.selection = 0;

        // ================= ANIMATE TAB =================
        var tAnim = tabs.add("tab", undefined, "Animate");
        tAnim.orientation = "column";
        tAnim.alignChildren = ["left", "top"];
        tAnim.add("statictext", undefined, "Preset:");
        var presetNames = [];
        for (var pi = 0; pi < KCF_PRESET_LABELS.length; pi++) {
            presetNames.push(KCF_PRESET_LABELS[pi][1]);
        }
        var lbPreset = tAnim.add("listbox", undefined, presetNames);
        lbPreset.preferredSize.height = 180;
        lbPreset.selection = 0;
        var etPopScale = numField(tAnim, "Pop scale % (100 = no pop):",
            loadSetting("popScale", "112"));
        var etActiveBox = colorField(tAnim, "Active box color:",
            loadSetting("activeBoxColor", "#FF3B30"));
        var etBoxRadius = numField(tAnim, "Box corner radius (px):",
            loadSetting("boxRadius", "18"));

        tabs.selection = 0;

        // ================= ACTIONS + PREVIEW =================
        var gActions = content.add("group");
        gActions.alignment = "fill";
        var btnTranscribe = gActions.add("button", undefined, "Transcribe");
        var btnLoadJson = gActions.add("button", undefined, "Load JSON");
        var btnGenerate = gActions.add("button", undefined, "Generate Captions");
        var btnClear = gActions.add("button", undefined, "Clear Generated");

        var stStatus = content.add("statictext", undefined, "Ready.");
        stStatus.alignment = "fill";

        var etPreview = content.add("edittext", undefined, "", {
            multiline: true, readonly: true, scrolling: true
        });
        etPreview.alignment = ["fill", "top"];
        etPreview.preferredSize.height = 90;

        // ---- helpers ----
        function status(msg) {
            stStatus.text = msg;
            win.update && win.update();
        }
        function host() { return etHost.text || "127.0.0.1"; }
        function port() { return parseInt(etPort.text, 10) || 8765; }
        function langCode() {
            var i = ddLang.selection ? ddLang.selection.index : 0;
            return ["ka-GE", "en-US", "auto"][i];
        }
        function providerId() {
            var i = ddProv.selection ? ddProv.selection.index : 0;
            return state.providerIds[i];
        }
        function gatherSettings() {
            var anchorIdx = ddAnchor.selection ? ddAnchor.selection.index : 0;
            var alignIdx = ddAlign.selection ? ddAlign.selection.index : 0;
            var presetIdx = lbPreset.selection ? lbPreset.selection.index : 0;
            return {
                font: currentFontPS(),
                fontSize: parseFloat(etFontSize.text) || 72,
                tracking: parseFloat(etTracking.text) || 0,
                lineHeight: parseFloat(etLineHeight.text) || 0,
                wordSpacing: parseFloat(etWordSpacing.text) || 24,
                wordsPerLine: parseInt(etWordsPerLine.text, 10) || 0,
                charsPerLine: parseInt(etCharsPerLine.text, 10) || 0,
                fauxBold: cbFauxBold.value,
                fillColor: KCF_hexToRgb(etFill.text),
                highlightColor: KCF_hexToRgb(etHighlight.text),
                shadow: cbShadow.value,
                stroke: cbStroke.value,
                strokeColor: KCF_hexToRgb(etStrokeColor.text),
                strokeWidth: parseFloat(etStrokeW.text) || 4,
                backgroundBox: cbBox.value,
                boxColor: KCF_hexToRgb(etBoxColor.text),
                popScale: parseFloat(etPopScale.text) || 112,
                activeBoxColor: KCF_hexToRgb(etActiveBox.text),
                boxRadius: parseFloat(etBoxRadius.text) || 0,
                anchorPreset: ["bottom_center", "center", "top_center", "custom"][anchorIdx],
                alignment: ["center", "left", "right"][alignIdx],
                x: parseFloat(etX.text) || 960,
                y: parseFloat(etY.text) || 1600,
                verticalOffset: parseFloat(etVOffset.text) || 0,
                safeMargin: parseFloat(etSafe.text) || 160,
                preset: KCF_PRESET_LABELS[presetIdx][0]
            };
        }
        function showPreview(doc, warnings) {
            var lines = [];
            if (warnings && warnings.length) {
                lines.push("WARNINGS: " + warnings.join(" | "), "");
            }
            for (var i = 0; i < doc.captions.length; i++) {
                var c = doc.captions[i];
                lines.push("[" + c.start.toFixed(2) + "-" + c.end.toFixed(2) + "] " + c.text);
            }
            etPreview.text = lines.join("\n");
        }
        function persistSettings() {
            saveSetting("host", etHost.text);
            saveSetting("port", etPort.text);
            saveSetting("font", currentFontPS());
            saveSetting("fontSize", etFontSize.text);
            saveSetting("wordSpacing", etWordSpacing.text);
            saveSetting("wordsPerLine", etWordsPerLine.text);
            saveSetting("charsPerLine", etCharsPerLine.text);
            saveSetting("fillColor", etFill.text);
            saveSetting("highlightColor", etHighlight.text);
            saveSetting("maxWords", etMaxWords.text);
            saveSetting("popScale", etPopScale.text);
            saveSetting("activeBoxColor", etActiveBox.text);
            saveSetting("boxRadius", etBoxRadius.text);
        }

        // ---- handlers ----
        btnBrowse.onClick = function () {
            var f = File.openDialog("Select audio/video file");
            if (f) {
                state.mediaPath = f.fsName;
                etMedia.text = f.fsName;
            }
        };
        etMedia.onChange = function () { state.mediaPath = etMedia.text; };

        /* Footage file behind a layer, or null. Follows one precomp level. */
        function footageFileOfLayer(layer, depth) {
            if (!layer || !layer.source) { return null; }
            var src = layer.source;
            if (src instanceof FootageItem && src.file &&
                    !(src.mainSource instanceof SolidSource)) {
                return src.file;
            }
            if (src instanceof CompItem && depth > 0) {
                return firstFootageFileInComp(src, depth - 1);
            }
            return null;
        }
        function firstFootageFileInComp(comp, depth) {
            var fallback = null;
            for (var i = 1; i <= comp.numLayers; i++) {
                var f = footageFileOfLayer(comp.layer(i), depth);
                if (!f) { continue; }
                var hasAudio = false;
                try { hasAudio = comp.layer(i).hasAudio; } catch (e) {}
                if (hasAudio) { return f; }       // prefer layers with audio
                if (!fallback) { fallback = f; }
            }
            return fallback;
        }
        btnFromComp.onClick = function () {
            var comp = app.project ? app.project.activeItem : null;
            if (!(comp && comp instanceof CompItem)) {
                alert("No active composition selected.");
                return;
            }
            // selected layer wins, else first audio footage layer in comp
            var file = null;
            for (var s = 0; s < comp.selectedLayers.length && !file; s++) {
                file = footageFileOfLayer(comp.selectedLayers[s], 1);
            }
            if (!file) { file = firstFootageFileInComp(comp, 1); }
            if (!file) {
                alert("No footage file found in this comp. Select the video " +
                      "layer or use Browse.");
                return;
            }
            state.mediaPath = file.fsName;
            etMedia.text = file.fsName;
            status("Media from comp: " + file.displayName);
        };

        btnHealth.onClick = function () {
            status("Testing backend at " + host() + ":" + port() + "…");
            try {
                var h = KCF_httpJSON("GET", host(), port(), "/health", null);
                status("Backend OK v" + h.version + ". Providers ready: " +
                    (h.availableProviders.join(", ") || "none (add API keys)"));
            } catch (e) {
                alert(e.message);
                status("Backend not reachable.");
            }
        };

        btnScan.onClick = function () {
            try {
                status("Scanning providers…");
                var resp = KCF_httpJSON("GET", host(), port(), "/providers", null);
                var ids = [], labels = [];
                for (var i = 0; i < resp.providers.length; i++) {
                    var p = resp.providers[i];
                    ids.push(p.id);
                    labels.push((p.available ? "✓ " : "✗ ") + p.label +
                        (p.available ? "" : "  (" + (p.detail || "unavailable") + ")"));
                }
                state.providerIds = ids;
                var keep = ddProv.selection ? ddProv.selection.index : 0;
                ddProv.removeAll();
                for (var j = 0; j < labels.length; j++) { ddProv.add("item", labels[j]); }
                ddProv.selection = Math.min(keep, labels.length - 1);
                status("Provider scan done.");
            } catch (e) {
                alert(e.message);
                status("Scan failed.");
            }
        };

        btnTranscribe.onClick = function () {
            if (!state.mediaPath) {
                btnFromComp.onClick();           // try the active comp's footage
            }
            if (!state.mediaPath) {
                alert("Select a media file first.");
                return;
            }
            persistSettings();
            var providerOptions = { diarize: cbDiarize.value };
            if (etModel.text) { providerOptions.model = etModel.text; }
            if (etKeyterms.text) {
                var terms = etKeyterms.text.split(",");
                var clean = [];
                for (var t = 0; t < terms.length; t++) {
                    var term = terms[t].replace(/^\s+|\s+$/g, "");
                    if (term) { clean.push(term); }
                }
                if (clean.length) { providerOptions.keyterms = clean; }
            }
            var payload = {
                mediaPath: state.mediaPath,
                language: langCode(),
                provider: providerId(),
                providerOptions: providerOptions,
                grouping: {
                    maxWords: parseInt(etMaxWords.text, 10) || 4,
                    maxChars: parseInt(etMaxChars.text, 10) || 42,
                    pauseBreakSeconds: parseFloat(etPause.text) || 0.55,
                    minCaptionDuration: parseFloat(etMinDur.text) || 0.5,
                    maxCaptionDuration: parseFloat(etMaxDur.text) || 3.5
                }
            };
            try {
                status("Transcribing (" + providerId() + ")… this can take a while.");
                var resp = KCF_httpJSON("POST", host(), port(), "/transcribe", payload);
                state.doc = resp.document;
                showPreview(state.doc, resp.warnings);
                status("Transcribed: " + state.doc.words.length + " words, " +
                    state.doc.captions.length + " captions. Debug: " +
                    resp.debugPaths.normalizedJson);
            } catch (e) {
                alert(e.message);
                status("Transcription failed.");
            }
        };

        btnLoadJson.onClick = function () {
            var f = File.openDialog("Select normalized.json");
            if (!f) { return; }
            try {
                f.encoding = "UTF-8";
                f.open("r");
                var text = f.read();
                f.close();
                var doc = JSON.parse(text);
                if (!doc.captions) { throw new Error("Not a normalized transcript JSON."); }
                state.doc = doc;
                showPreview(doc, []);
                status("Loaded " + doc.captions.length + " captions from JSON.");
            } catch (e) {
                alert("Could not load JSON: " + e.message);
            }
        };

        btnGenerate.onClick = function () {
            if (!state.doc) {
                alert("No transcript. Transcribe or load a JSON first.");
                return;
            }
            persistSettings();
            try {
                var name = KCF_generate(state.doc, gatherSettings());
                status("Generated precomp: " + name);
            } catch (e) {
                alert(e.message);
                status("Generation failed.");
            }
        };

        btnClear.onClick = function () {
            if (!confirm("Delete ALL generated KCF_Captions_* precomps from this project?")) {
                return;
            }
            var n = KCF_clearGenerated();
            status("Removed " + n + " generated precomp(s).");
        };

        // ---- scrolling ----
        function updateScroll() {
            if (!scroller.size || !content.size) { return; }
            var overflow = content.size.height - scroller.size.height;
            if (overflow > 0) {
                sbScroll.visible = true;
                sbScroll.minvalue = 0;
                sbScroll.maxvalue = overflow;
                sbScroll.jumpdelta = Math.max(20, scroller.size.height - 40);
                if (sbScroll.value > overflow) { sbScroll.value = overflow; }
            } else {
                sbScroll.visible = false;
                sbScroll.value = 0;
            }
            content.location.y = -Math.round(sbScroll.value);
        }
        sbScroll.onChanging = sbScroll.onChange = function () {
            content.location.y = -Math.round(sbScroll.value);
        };
        tabs.onChange = function () { updateScroll(); };

        win.onResizing = win.onResize = function () {
            this.layout.resize();
            updateScroll();
        };
        win.layout.layout(true);
        win.layout.resize();
        updateScroll();
        if (win instanceof Window) {
            win.center();
            win.show();
            updateScroll();
        }
        return win;
    }

    buildUI(thisObj);

})(this);
