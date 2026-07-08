/* AE layer generation from a normalized TranscriptDocument.
   Never destroys user work: everything goes into a fresh precomp inside
   the "Kartuli Caption Forge" project folder. */

var KCF_FOLDER_NAME = "Kartuli Caption Forge";

/* Rounded-rectangle shape layer (solids can't have corner radius).
   Positioned by its center, like a solid. */
function KCF_addRoundRect(comp, name, w, h, color, radius, x, y) {
    var shape = comp.layers.addShape();
    shape.name = name;
    var group = shape.property("ADBE Root Vectors Group")
        .addProperty("ADBE Vector Group");
    var rect = group.property("ADBE Vectors Group")
        .addProperty("ADBE Vector Shape - Rect");
    rect.property("ADBE Vector Rect Size").setValue([w, h]);
    rect.property("ADBE Vector Rect Roundness").setValue(radius || 0);
    var fill = group.property("ADBE Vectors Group")
        .addProperty("ADBE Vector Graphic - Fill");
    fill.property("ADBE Vector Fill Color").setValue(
        [color[0], color[1], color[2], 1]);
    shape.property("Transform").property("Position").setValue([x, y]);
    return shape;
}

function KCF_findOrCreateFolder(proj, name) {
    for (var i = 1; i <= proj.numItems; i++) {
        var item = proj.item(i);
        if (item instanceof FolderItem && item.name === name) {
            return item;
        }
    }
    return proj.items.addFolder(name);
}

/* Anchor preset -> base {x, y} in comp pixels. */
function KCF_anchorPosition(settings, comp) {
    var margin = settings.safeMargin;                  // px from edge
    var x, y;
    switch (settings.anchorPreset) {
    case "bottom_center": x = comp.width / 2; y = comp.height - margin; break;
    case "center":        x = comp.width / 2; y = comp.height / 2;      break;
    case "top_center":    x = comp.width / 2; y = margin + settings.fontSize; break;
    default:              x = settings.x;     y = settings.y;           break;
    }
    return { x: x, y: y + (settings.verticalOffset || 0) };
}

function KCF_wordsForCaption(doc, caption) {
    var byId = {};
    for (var i = 0; i < doc.words.length; i++) {
        byId[doc.words[i].id] = doc.words[i];
    }
    var out = [];
    for (var j = 0; j < caption.wordIds.length; j++) {
        var w = byId[caption.wordIds[j]];
        if (w) { out.push(w); }
    }
    return out;
}

/* Break word indices into visual lines.
   wordsPerLine / charsPerLine: 0 disables that limit. */
function KCF_breakLines(words, settings) {
    var maxWpl = settings.wordsPerLine || 0;
    var maxCpl = settings.charsPerLine || 0;
    var lines = [[]];
    var lineChars = 0;
    for (var i = 0; i < words.length; i++) {
        var text = words[i].text + (words[i].punctuationAfter || "");
        var cur = lines[lines.length - 1];
        var wouldBe = lineChars + (cur.length > 0 ? 1 : 0) + text.length;
        if (cur.length > 0 &&
                ((maxWpl > 0 && cur.length >= maxWpl) ||
                 (maxCpl > 0 && wouldBe > maxCpl))) {
            lines.push([]);
            lineChars = 0;
            cur = lines[lines.length - 1];
            wouldBe = text.length;
        }
        cur.push(i);
        lineChars = wouldBe;
    }
    return lines;
}

/* Build all word layers for one caption inside precomp. */
function KCF_buildCaption(precomp, doc, caption, ci, settings, pos) {
    var words = KCF_wordsForCaption(doc, caption);
    if (words.length === 0) { return; }

    // 1) create + style layers, collect measured rects
    var layers = [], rects = [];
    var spacing = settings.wordSpacing;
    var maxH = 0;
    for (var i = 0; i < words.length; i++) {
        var displayText = words[i].text + (words[i].punctuationAfter || "");
        var layer = precomp.layers.addText(displayText);
        KCF_styleTextLayer(layer, settings);
        var rect = layer.sourceRectAtTime(0, false);
        layers.push(layer);
        rects.push(rect);
        if (rect.height > maxH) { maxH = rect.height; }
    }

    // 2) break into lines, measure each line
    var lines = KCF_breakLines(words, settings);
    var lineGap = (settings.lineHeight && settings.lineHeight > 0)
        ? settings.lineHeight : Math.round(settings.fontSize * 1.2);
    var lineWidths = [];
    var maxLineWidth = 0;
    for (var li = 0; li < lines.length; li++) {
        var lw = 0;
        for (var wi = 0; wi < lines[li].length; wi++) {
            lw += rects[lines[li][wi]].width;
        }
        lw += spacing * (lines[li].length - 1);
        lineWidths.push(lw);
        if (lw > maxLineWidth) { maxLineWidth = lw; }
    }

    // bottom anchor: block grows upward so the LAST line sits at pos.y
    var baseY = pos.y;
    if (settings.anchorPreset === "bottom_center") {
        baseY = pos.y - (lines.length - 1) * lineGap;
    }

    // 3) position, name, metadata, preset — per line
    var preset = KCF_PRESETS[settings.preset] || KCF_PRESETS.highlight_word;
    var perWord = (preset instanceof Function) ? preset : preset.perWord;
    var layouts = [];
    var minX = null, maxX = null;
    for (var l = 0; l < lines.length; l++) {
        var lineY = baseY + l * lineGap;
        var startX;
        if (settings.alignment === "left") { startX = pos.x; }
        else if (settings.alignment === "right") { startX = pos.x - lineWidths[l]; }
        else { startX = pos.x - lineWidths[l] / 2; }
        if (minX === null || startX < minX) { minX = startX; }
        if (maxX === null || startX + lineWidths[l] > maxX) { maxX = startX + lineWidths[l]; }

        var cursor = startX;
        for (var k = 0; k < lines[l].length; k++) {
            var idx = lines[l][k];
            var lyr = layers[idx];
            var w = words[idx];
            var basePos = [cursor - rects[idx].left, lineY];
            lyr.property("Transform").property("Position").setValue(basePos);
            lyr.name = "KCF_C" + KCF_pad3(ci) + "_W" + KCF_pad3(idx) + "_" + w.text;
            lyr.comment = JSON.stringify({
                tool: "Kartuli Caption Forge",
                captionId: caption.id,
                wordId: w.id,
                start: w.start,
                end: w.end,
                line: l,
                preset: settings.preset
            });
            lyr.inPoint = caption.start;
            lyr.outPoint = Math.max(caption.end, caption.start + 0.05);
            if (settings.shadow) {
                try {
                    var sh = lyr.property("Effects").addProperty("ADBE Drop Shadow");
                    sh.property("ADBE Drop Shadow-0002").setValue(0.6); // opacity
                } catch (e) { /* effect unavailable */ }
            }
            perWord(lyr, w, caption, settings, basePos);
            layouts.push({ layer: lyr, word: w, rect: rects[idx], pos: basePos });
            cursor += rects[idx].width + spacing;
        }
    }

    // preset-specific extra layers (e.g. per-word boxes)
    if (preset.after) {
        preset.after(precomp, layouts, caption, ci, settings);
    }

    // 4) optional background box behind all lines
    if (settings.backgroundBox) {
        var pad = Math.round(settings.fontSize * 0.35);
        var boxW = Math.ceil((maxX - minX) + pad * 2);
        var boxH = Math.ceil((lines.length - 1) * lineGap + maxH + pad * 2);
        // rects are baseline-relative: top is negative above the baseline
        var top = rects[0] ? rects[0].top : -settings.fontSize;
        var box = KCF_addRoundRect(
            precomp, "KCF_C" + KCF_pad3(ci) + "_BOX",
            boxW, boxH, settings.boxColor, settings.boxRadius || 0,
            (minX + maxX) / 2,
            baseY + top + ((lines.length - 1) * lineGap + maxH) / 2);
        box.inPoint = caption.start;
        box.outPoint = Math.max(caption.end, caption.start + 0.05);
        // layers[0] was created first, so it is the bottom-most text layer;
        // placing the box after it puts the box below ALL caption text
        box.moveAfter(layers[0]);
    }
}

/* Main entry: generate one precomp with all captions, drop it in the
   active comp. Returns the precomp name. */
function KCF_generate(doc, settings) {
    var proj = app.project;
    if (!proj) { throw new Error("No project open."); }
    var activeComp = proj.activeItem;
    if (!(activeComp && activeComp instanceof CompItem)) {
        throw new Error("No active composition selected.");
    }
    if (!doc || !doc.captions || doc.captions.length === 0) {
        throw new Error("No captions in transcript. Transcribe first.");
    }
    if (!doc.words || doc.words.length === 0) {
        throw new Error("Transcript has text but no word timings. " +
            "Animation requires word timings.");
    }

    app.beginUndoGroup("KCF Generate Captions");
    try {
        var folder = KCF_findOrCreateFolder(proj, KCF_FOLDER_NAME);
        var name = "KCF_Captions_" + KCF_timestamp();
        var duration = Math.max(activeComp.duration, (doc.duration || 0) + 1);
        var precomp = proj.items.addComp(
            name, activeComp.width, activeComp.height,
            activeComp.pixelAspect, duration, activeComp.frameRate);
        precomp.parentFolder = folder;

        var pos = KCF_anchorPosition(settings, precomp);
        for (var ci = 0; ci < doc.captions.length; ci++) {
            KCF_buildCaption(precomp, doc, doc.captions[ci], ci, settings, pos);
        }

        var compLayer = activeComp.layers.add(precomp);
        compLayer.name = name;
        compLayer.moveToBeginning();
        return name;
    } finally {
        app.endUndoGroup();
    }
}

/* Remove generated caption precomps (asks per item is handled by caller). */
function KCF_clearGenerated() {
    var proj = app.project;
    if (!proj) { return 0; }
    app.beginUndoGroup("KCF Clear Generated Captions");
    var removed = 0;
    try {
        var doomed = [];
        for (var i = 1; i <= proj.numItems; i++) {
            var item = proj.item(i);
            if (item instanceof CompItem && item.name.indexOf("KCF_Captions_") === 0) {
                doomed.push(item);
            }
        }
        for (var d = 0; d < doomed.length; d++) {
            doomed[d].remove();
            removed++;
        }
    } finally {
        app.endUndoGroup();
    }
    return removed;
}
