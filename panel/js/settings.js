(function (root) {
    "use strict";
    var defaults = {
        preset: "highlight_word", font: "ArialMT", fontSize: 72, tracking: 0, lineHeight: 0, wordSpacing: 18,
        wordsPerLine: 4, minWordsPerLine: 2, charsPerLine: 42, fauxBold: true, fauxItalic: false,
        fill: true, fillColor: "#F4F2ED", highlightColor: "#B4A5FF", shadow: true,
        shadowColor: "#000000", shadowOpacity: 55, shadowDistance: 4, shadowAngle: 135, shadowSoftness: 12,
        stroke: false, strokeColor: "#141416", strokeWidth: 4, strokePosition: "outer",
        backgroundBox: false, boxColor: "#141416", boxOpacity: 100, boxRadius: 14, activeBoxColor: "#B4A5FF", popScale: 112,
        anchorPreset: "bottom_center", alignment: "center", safeMargin: 120, x: 960, y: 960, verticalOffset: 0,
        slideAngle: 0, slideDistance: 50, slideDuration: 0.35, slideDolly: 0, slideEaseIn: 100, slideEaseOut: 98, slideMotionBlur: true,
        fitBoundary: false, fitWidth: 0, fitMaxFontSize: 260, fitMaxTracking: 120,
        styleShuffle: false, shuffleVariants: ["solid", "highlight", "outline"], shuffleFonts: [], shuffleSeed: 0
    };
    var ranges = {
        fontSize: [8, 600], tracking: [-200, 1000], lineHeight: [0, 1000], wordSpacing: [0, 200],
        wordsPerLine: [0, 100], minWordsPerLine: [1, 100], charsPerLine: [0, 1000],
        strokeWidth: [0, 100], safeMargin: [0, 2000], x: [-10000, 10000], y: [-10000, 10000], verticalOffset: [-10000, 10000],
        slideAngle: [0, 360], slideDistance: [0, 2000], slideDuration: [0.01, 5], slideDolly: [-90, 300],
        slideEaseIn: [0.1, 100], slideEaseOut: [0.1, 100], popScale: [100, 200], boxOpacity: [0, 100], boxRadius: [0, 200],
        fitWidth: [0, 10000], fitMaxFontSize: [8, 1000], fitMaxTracking: [0, 1000],
        shadowOpacity: [0, 100], shadowDistance: [0, 200], shadowAngle: [0, 360], shadowSoftness: [0, 200]
    };
    function normalize(input) {
        var result = {};
        Object.keys(defaults).forEach(function (key) {
            var value = input && input[key] !== undefined ? input[key] : defaults[key];
            if (ranges[key]) {
                value = Number(value);
                if (!isFinite(value)) { throw new Error("Check the value for " + key + "."); }
                value = Math.max(ranges[key][0], Math.min(ranges[key][1], value));
            } else if (/Color$/.test(key)) {
                if (!/^#[0-9a-f]{6}$/i.test(value)) { throw new Error("Colors must use six-digit hex values."); }
            } else if (typeof defaults[key] === "boolean") { value = value === true; }
            else if (typeof defaults[key] === "string") { value = String(value).slice(0, 160); }
            result[key] = value;
        });
        ["wordsPerLine", "minWordsPerLine", "charsPerLine"].forEach(function (key) { result[key] = Math.round(result[key]); });
        if (result.wordsPerLine > 0) { result.minWordsPerLine = Math.min(result.minWordsPerLine, result.wordsPerLine); }
        if (["bottom_center", "center", "top_center", "custom"].indexOf(result.anchorPreset) < 0) { result.anchorPreset = defaults.anchorPreset; }
        if (["left", "center", "right"].indexOf(result.alignment) < 0) { result.alignment = "center"; }
        if (["outer", "center"].indexOf(result.strokePosition) < 0) { result.strokePosition = "outer"; }
        result.shuffleVariants = Array.isArray(result.shuffleVariants) ? result.shuffleVariants.filter(function (v) { return ["solid", "highlight", "outline"].indexOf(v) >= 0; }) : defaults.shuffleVariants.slice();
        result.shuffleFonts = Array.isArray(result.shuffleFonts) ? result.shuffleFonts.filter(function (v) { return typeof v === "string"; }).map(function (v) { return v.slice(0, 160); }).slice(0, 20) : [];
        result.shuffleSeed = isFinite(Number(result.shuffleSeed)) ? Math.max(0, Math.min(2147483646, Math.round(Number(result.shuffleSeed)))) : 0;
        return result;
    }
    function rgb(hex) { return [1, 3, 5].map(function (offset) { return parseInt(hex.slice(offset, offset + 2), 16) / 255; }); }
    function forAE(input) { var result = normalize(input); Object.keys(result).forEach(function (key) { if (/Color$/.test(key)) { result[key] = rgb(result[key]); } }); return result; }
    function isSavedLook(data) { return !!(data && ["CapForge", "Kartuli Caption Forge"].indexOf(data.tool) >= 0 && data.version === 1 && data.settings); }
    var api = { defaults: defaults, normalize: normalize, forAE: forAE, isSavedLook: isSavedLook };
    if (typeof module !== "undefined" && module.exports) { module.exports = api; } else { root.KCF_Settings = api; }
}(this));
