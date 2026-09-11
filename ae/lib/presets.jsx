/* Animation presets. Each preset gets (layer, word, caption, style, basePos).
   Layers arrive anchored at their visual centre and positioned at basePos
   (so basePos IS that centre) with caption-span in/out points.
   Presets only adjust timing/keyframes/effects — never layout. */

// --- keyframe helpers -------------------------------------------------

function KCF_prop(layer, name) {
    return layer.property("Transform").property(name);
}

function KCF_setKeys(prop, times, values, hold) {
    for (var i = 0; i < times.length; i++) {
        prop.setValueAtTime(times[i], values[i]);
    }
    if (hold) {
        for (var k = 1; k <= prop.numKeys; k++) {
            prop.setInterpolationTypeAtKey(k, KeyframeInterpolationType.HOLD);
        }
    }
}

/* Fill effect drives per-word color changes (overrides text fill). */
function KCF_addFillEffect(layer, baseColor) {
    var fx = layer.property("Effects").addProperty("ADBE Fill");
    fx.property("ADBE Fill-0002").setValue(baseColor);
    return fx.property("ADBE Fill-0002");
}

function KCF_highlightColorKeys(layer, word, caption, style) {
    var colorProp = KCF_addFillEffect(layer, style.fillColor);
    var t0 = Math.max(caption.start, word.start - 0.001);
    KCF_setKeys(colorProp,
        [caption.start, word.start, Math.min(word.end, caption.end)],
        [style.fillColor, style.highlightColor, style.fillColor],
        true);
    return colorProp;
}

function KCF_scalePop(layer, tStart, tEnd, peak) {
    var mid = tStart + (tEnd - tStart) * 0.4;
    KCF_setKeys(KCF_prop(layer, "Scale"),
        [tStart, mid, tEnd],
        [[100, 100], [peak, peak], [100, 100]], false);
}

/* Apply Premiere-style ease influences (0-100) to every keyframe on a
   property. Spatial properties such as Position carry a single temporal
   ease; other multi-dimensional ones need one per dimension. */
function KCF_easeKeys(prop, dims, inInfluence, outInfluence) {
    if (!prop || prop.numKeys === 0) { return; }
    function clamp(v, fallback) {
        var n = (v === undefined || v === null || isNaN(v)) ? fallback : v;
        return Math.max(0.1, Math.min(100, n));
    }
    var easeIn = [], easeOut = [];
    for (var d = 0; d < dims; d++) {
        easeIn.push(new KeyframeEase(0, clamp(inInfluence, 100)));
        easeOut.push(new KeyframeEase(0, clamp(outInfluence, 100)));
    }
    for (var k = 1; k <= prop.numKeys; k++) {
        // older AE builds reject eases on some property types
        try { prop.setTemporalEaseAtKey(k, easeIn, easeOut); } catch (e) {}
    }
}

/* Where a sliding word starts, relative to where it comes to rest.
   Angle 0 means it flies up from below; the angle increases clockwise,
   matching AE's rotation dial, so 90 is from the left, 180 from above
   and 270 from the right. Comp space has +y pointing downward. */
function KCF_slideOffset(angleDeg, distance) {
    var th = (angleDeg || 0) * Math.PI / 180;
    var d = distance || 0;
    return [-d * Math.sin(th), d * Math.cos(th)];
}

/* Inverse of KCF_slideOffset: the angle a point dragged to (dx, dy)
   from the dial's centre stands for. Drives the panel's angle dial. */
function KCF_slideAngleFromPoint(dx, dy) {
    var deg = Math.atan2(-dx, dy) * 180 / Math.PI;
    return (deg < 0) ? deg + 360 : deg;
}

// --- presets ----------------------------------------------------------
// Entry = function (per-word hook) OR object:
//   { perWord: fn(layer, word, caption, style, basePos),
//     after:   fn(precomp, layouts, caption, ci, style) }   // extra layers
// layouts: [{layer, word, rect, pos, anchor}] in word order;
//   pos is the word's visual centre in comp space.

var KCF_PRESETS = {

    /* 1. All words visible; spoken word recolors + pops. */
    highlight_word: function (layer, word, caption, style, basePos) {
        layer.inPoint = caption.start;
        layer.outPoint = caption.end;
        KCF_highlightColorKeys(layer, word, caption, style);
        var peak = style.popScale || 112;
        if (peak > 100) {
            KCF_scalePop(layer, word.start, Math.min(word.end, caption.end), peak);
        }
    },

    /* 2. Each word appears when spoken, stays until caption end. */
    spawn_word: function (layer, word, caption, style, basePos) {
        var t0 = Math.max(caption.start, word.start - 0.05);
        layer.inPoint = t0;
        layer.outPoint = caption.end;
        KCF_setKeys(KCF_prop(layer, "Opacity"), [t0, word.start], [0, 100], false);
        KCF_setKeys(KCF_prop(layer, "Scale"),
            [t0, word.start + 0.06], [[92, 92], [100, 100]], false);
        KCF_setKeys(KCF_prop(layer, "Position"),
            [t0, word.start + 0.06],
            [[basePos[0], basePos[1] + 8], basePos], false);
    },

    /* 3. Words spawn when spoken and fade out individually. */
    word_disappear: function (layer, word, caption, style, basePos) {
        var t0 = Math.max(caption.start, word.start - 0.05);
        var fadeEnd = Math.min(word.end + 0.45, caption.end);
        layer.inPoint = t0;
        layer.outPoint = fadeEnd;
        KCF_setKeys(KCF_prop(layer, "Opacity"),
            [t0, word.start, Math.min(word.end, fadeEnd - 0.01), fadeEnd],
            [0, 100, 100, 0], false);
    },

    /* 4. All words visible dimmed; active word pops bright. */
    pop_karaoke: function (layer, word, caption, style, basePos) {
        layer.inPoint = caption.start;
        layer.outPoint = caption.end;
        var wEnd = Math.min(word.end, caption.end);
        KCF_highlightColorKeys(layer, word, caption, style);
        KCF_setKeys(KCF_prop(layer, "Opacity"),
            [caption.start, word.start, wEnd],
            [70, 100, 70], true);
        var peak = (style.popScale || 112) + 6;
        if (peak > 100) {
            KCF_scalePop(layer, word.start, wEnd, peak);
        }
    },

    /* 5. Sentence grows word by word (hard cuts, no motion). */
    typewriter: function (layer, word, caption, style, basePos) {
        layer.inPoint = word.start;
        layer.outPoint = caption.end;
        KCF_setKeys(KCF_prop(layer, "Opacity"),
            [word.start], [100], true);
    },

    /* 6. Minimal subtitle: static caption chunk, no animation. */
    minimal: function (layer, word, caption, style, basePos) {
        layer.inPoint = caption.start;
        layer.outPoint = caption.end;
    },

    /* 7. Brutalist Georgian: hard cuts, active word recolor, no easing. */
    brutalist: function (layer, word, caption, style, basePos) {
        layer.inPoint = caption.start;
        layer.outPoint = caption.end;
        KCF_highlightColorKeys(layer, word, caption, style);
    },

    /* 9. Active Word Box (CapCut style): colored box jumps from word
       to word, staying until the next word starts. */
    active_word_box: {
        perWord: function (layer, word, caption, style, basePos) {
            layer.inPoint = caption.start;
            layer.outPoint = caption.end;
            var peak = style.popScale || 0;
            if (peak > 100) {
                KCF_scalePop(layer, word.start, Math.min(word.end, caption.end), peak);
            }
        },
        after: function (precomp, layouts, caption, ci, style) {
            // uniform box height across the caption looks cleaner
            var maxH = 0;
            for (var i = 0; i < layouts.length; i++) {
                if (layouts[i].rect.height > maxH) { maxH = layouts[i].rect.height; }
            }
            var padX = Math.round(style.fontSize * 0.28);
            var padY = Math.round(style.fontSize * 0.18);
            for (var k = 0; k < layouts.length; k++) {
                var lo = layouts[k];
                var tStart = Math.max(caption.start, lo.word.start);
                // box stays until the NEXT word starts (jump feel), last
                // word's box holds to the caption end
                var tEnd = (k + 1 < layouts.length)
                    ? Math.max(tStart + 0.04, layouts[k + 1].word.start)
                    : caption.end;
                var box = KCF_addRoundRect(
                    precomp,
                    "KCF_C" + KCF_pad3(ci) + "_BOX_W" + KCF_pad3(k),
                    Math.ceil(lo.rect.width + padX * 2),
                    Math.ceil(maxH + padY * 2),
                    style.activeBoxColor || style.highlightColor,
                    style.boxRadius || 0,
                    lo.pos[0], lo.pos[1]);   // anchored at the word centre
                box.inPoint = tStart;
                box.outPoint = tEnd;
                // small settle pop when the box lands on a word
                KCF_setKeys(box.property("Transform").property("Scale"),
                    [tStart, tStart + 0.08], [[85, 85], [100, 100]], false);
                box.comment = JSON.stringify({
                    tool: "Kartuli Caption Forge",
                    captionId: caption.id, wordId: lo.word.id, box: true
                });
                box.moveAfter(layouts[0].layer);   // below all caption text
            }
        }
    },

    /* 10. Bounce In: word spawns with overshoot (trendy reels style). */
    bounce_in: function (layer, word, caption, style, basePos) {
        var t0 = Math.max(caption.start, word.start - 0.03);
        layer.inPoint = t0;
        layer.outPoint = caption.end;
        KCF_setKeys(KCF_prop(layer, "Opacity"), [t0, t0 + 0.06], [0, 100], false);
        KCF_setKeys(KCF_prop(layer, "Scale"),
            [t0, t0 + 0.12, t0 + 0.2],
            [[55, 55], [112, 112], [100, 100]], false);
    },

    /* 12. Slide In: each word flies in from the direction set on the
       angle dial, optionally scaling (dolly) and streaking (motion
       blur) on the way. Distance 0 makes it a pure fade. */
    slide_in: function (layer, word, caption, style, basePos) {
        var dur = (style.slideDuration > 0) ? style.slideDuration : 0.35;
        var t0 = Math.max(caption.start, word.start - 0.06);
        var t1 = Math.min(t0 + dur, caption.end);
        if (t1 <= t0) { t1 = t0 + 0.05; }
        layer.inPoint = t0;
        layer.outPoint = caption.end;

        var offset = KCF_slideOffset(style.slideAngle, style.slideDistance);
        var position = KCF_prop(layer, "Position");
        KCF_setKeys(position, [t0, t1],
            [[basePos[0] + offset[0], basePos[1] + offset[1]], basePos], false);
        KCF_easeKeys(position, 1, style.slideEaseIn, style.slideEaseOut);

        // fade completes before the slide does, so the settle stays visible
        KCF_setKeys(KCF_prop(layer, "Opacity"),
            [t0, t0 + (t1 - t0) * 0.45], [0, 100], false);

        var dolly = style.slideDolly || 0;
        if (dolly !== 0) {
            var from = 100 + dolly;
            var scale = KCF_prop(layer, "Scale");
            KCF_setKeys(scale, [t0, t1], [[from, from], [100, 100]], false);
            KCF_easeKeys(scale, 2, style.slideEaseIn, style.slideEaseOut);
        }

        if (style.slideMotionBlur) {
            layer.motionBlur = true;
            // blur only renders if the comp has it switched on too
            try { layer.containingComp.motionBlur = true; } catch (e) {}
        }
    },

    /* 11. Caption Pop: whole caption block pops in as one unit. */
    pop_caption: function (layer, word, caption, style, basePos) {
        layer.inPoint = caption.start;
        layer.outPoint = caption.end;
        KCF_setKeys(KCF_prop(layer, "Opacity"),
            [caption.start, caption.start + 0.08], [0, 100], false);
        KCF_setKeys(KCF_prop(layer, "Scale"),
            [caption.start, caption.start + 0.12, caption.start + 0.18],
            [[70, 70], [106, 106], [100, 100]], false);
    },

    /* 8. Neon pulse: glow + active word opacity pulse. */
    neon_pulse: function (layer, word, caption, style, basePos) {
        layer.inPoint = caption.start;
        layer.outPoint = caption.end;
        try {
            var glow = layer.property("Effects").addProperty("ADBE Glo2");
            glow.property("ADBE Glo2-0003").setValue(18); // radius
        } catch (e) { /* glow unavailable */ }
        KCF_highlightColorKeys(layer, word, caption, style);
        var wEnd = Math.min(word.end, caption.end);
        KCF_setKeys(KCF_prop(layer, "Opacity"),
            [caption.start, word.start, word.start + (wEnd - word.start) / 2, wEnd],
            [82, 100, 88, 82], false);
    }
};

var KCF_PRESET_LABELS = [
    ["highlight_word", "Highlight Word"],
    ["active_word_box", "Active Word Box"],
    ["spawn_word", "Spawn Word-by-Word"],
    ["bounce_in", "Bounce In"],
    ["slide_in", "Slide In"],
    ["word_disappear", "Word-by-Word Disappear"],
    ["pop_karaoke", "Pop Karaoke"],
    ["pop_caption", "Caption Pop"],
    ["typewriter", "Typewriter"],
    ["minimal", "Minimal Subtitle"],
    ["brutalist", "Brutalist Georgian"],
    ["neon_pulse", "Neon Pulse"]
];
