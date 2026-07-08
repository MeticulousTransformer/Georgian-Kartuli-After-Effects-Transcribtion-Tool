/* Text styling + measurement helpers for AE word layers. */

// "#FFCC00" or "FFCC00" -> [1, 0.8, 0]
function KCF_hexToRgb(hex) {
    hex = String(hex).replace(/^#/, "");
    if (hex.length === 3) {
        hex = hex.charAt(0) + hex.charAt(0) +
              hex.charAt(1) + hex.charAt(1) +
              hex.charAt(2) + hex.charAt(2);
    }
    var n = parseInt(hex, 16);
    if (isNaN(n)) { return [1, 1, 1]; }
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function KCF_pad3(n) {
    var s = String(n);
    while (s.length < 3) { s = "0" + s; }
    return s;
}

function KCF_timestamp() {
    var d = new Date();
    function p(x) { return (x < 10 ? "0" : "") + x; }
    return "" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) +
        "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
}

/* Apply typography settings to a text layer's TextDocument. */
function KCF_styleTextLayer(textLayer, style) {
    var prop = textLayer.property("Source Text");
    var doc = prop.value;
    if (style.font) { doc.font = style.font; }
    doc.fontSize = style.fontSize;
    doc.applyFill = true;
    doc.fillColor = style.fillColor;
    doc.tracking = style.tracking;
    if (style.lineHeight && style.lineHeight > 0) {
        doc.autoLeading = false;
        doc.leading = style.lineHeight;
    }
    if (style.stroke) {
        doc.applyStroke = true;
        doc.strokeColor = style.strokeColor;
        doc.strokeWidth = style.strokeWidth;
        doc.strokeOverFill = false;
    } else {
        doc.applyStroke = false;
    }
    doc.justification = ParagraphJustification.LEFT_JUSTIFY;
    if (style.fauxBold !== undefined && doc.fauxBold !== undefined) {
        try { doc.fauxBold = style.fauxBold; } catch (e) { /* pre-CC2019 */ }
    }
    prop.setValue(doc);
}

/* Measure a layer's source rect at a time where the layer exists. */
function KCF_measureLayer(layer, comp) {
    var t = Math.max(layer.inPoint, 0);
    return layer.sourceRectAtTime(t, false);
}
