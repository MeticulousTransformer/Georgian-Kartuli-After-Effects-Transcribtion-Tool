/* Canvas approximation of the AE presets. No network, DOM text injection or ASR. */
(function (root) {
    "use strict";
    function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
    function ease(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
    // Approximate AE's zero-speed temporal ease with a cubic Bezier curve.
    function temporalEase(progress, influenceIn, influenceOut) {
        var x = clamp(progress, 0, 1), a = clamp(influenceOut / 100, 0.001, 1), b = 1 - clamp(influenceIn / 100, 0.001, 1);
        var lo = 0, hi = 1, t = x;
        for (var i = 0; i < 24; i++) {
            t = (lo + hi) / 2;
            var position = 3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
            if (position < x) { lo = t; } else { hi = t; }
        }
        return 3 * (1 - t) * t * t + t * t * t;
    }
    function motion(id, word, caption, time, settings) {
        var age = time - word.start, active = time >= word.start && time < word.end;
        var state = { alpha: 1, scale: 1, dy: 0, dx: 0, active: active, glow: 0, box: false };
        var pop = 1 + Math.sin(clamp(age / (word.end - word.start), 0, 1) * Math.PI) * (settings.popScale - 100) / 100;
        if (["highlight_word", "pop_karaoke", "active_word_box"].indexOf(id) >= 0 && active) { state.scale = pop; }
        if (id === "pop_karaoke") { state.alpha = active ? 1 : 0.7; }
        if (id === "active_word_box") { state.box = active; }
        if (id === "minimal" || id === "pop_caption") { state.active = false; }
        if (["spawn_word", "bounce_in", "word_disappear", "typewriter", "soft_rise"].indexOf(id) >= 0) {
            state.active = false;
            if (age < 0) { state.alpha = 0; }
            else {
                var progress = ease(age / (id === "slide_in" ? settings.slideDuration : 0.22));
                if (id === "typewriter") { progress = 1; }
                state.alpha = progress;
                if (id === "spawn_word") { state.scale = 0.92 + progress * 0.08; state.dy = (1 - progress) * 8; }
                if (id === "soft_rise") { state.dy = (1 - progress) * 12; }
                if (id === "bounce_in") { state.scale = 1 - Math.exp(-age * 18) * Math.cos(age * 24) * 0.3; }
                if (id === "word_disappear" && time > word.end) { state.alpha = clamp(1 - (time - word.end) / 0.45, 0, 1); }
            }
        }
        if (id === "slide_in") {
            var start = Math.max(caption.start, word.start - 0.06), end = Math.min(start + settings.slideDuration, caption.end);
            if (end <= start) { end = start + 0.05; }
            var elapsed = (time - start) / (end - start);
            var settled = temporalEase(elapsed, settings.slideEaseIn, settings.slideEaseOut);
            var angle = settings.slideAngle * Math.PI / 180;
            state.active = false; state.alpha = clamp(elapsed / 0.45, 0, 1);
            state.dx = -(1 - settled) * settings.slideDistance * Math.sin(angle);
            state.dy = (1 - settled) * settings.slideDistance * Math.cos(angle);
            state.scale = 1 + (1 - settled) * settings.slideDolly / 100;
        }
        if (id === "pop_caption") { state.scale = 0.7 + ease((time - caption.start) / 0.18) * 0.3; }
        if (id === "neon_pulse") { state.glow = active ? 18 : 5; state.alpha = active ? 1 : 0.82; }
        return state;
    }
    function wrap(words, settings) {
        var lines = [], current = [], chars = 0;
        words.forEach(function (word) {
            var length = (word.text + (word.punctuationAfter || "")).length;
            if (current.length && ((settings.wordsPerLine > 0 && current.length >= settings.wordsPerLine) || (settings.charsPerLine > 0 && chars + length + 1 > settings.charsPerLine))) { lines.push(current); current = []; chars = 0; }
            chars += length + (current.length ? 1 : 0); current.push(word);
        });
        if (current.length) { lines.push(current); }
        // Mirror the engine's soft minimum without crossing character/word limits.
        for (var i = 1; i < lines.length; i++) {
            while (lines[i].length < settings.minWordsPerLine && lines[i - 1].length > settings.minWordsPerLine) {
                var candidate = [lines[i - 1][lines[i - 1].length - 1]].concat(lines[i]);
                if ((settings.wordsPerLine > 0 && candidate.length > settings.wordsPerLine) || (settings.charsPerLine > 0 && candidate.map(function (w) { return w.text + (w.punctuationAfter || ""); }).join(" ").length > settings.charsPerLine)) { break; }
                lines[i - 1].pop(); lines[i] = candidate;
            }
        }
        return lines;
    }
    function rounded(ctx, x, y, width, height, radius) {
        radius = Math.min(radius, width / 2, height / 2);
        ctx.beginPath(); ctx.moveTo(x + radius, y); ctx.arcTo(x + width, y, x + width, y + height, radius); ctx.arcTo(x + width, y + height, x, y + height, radius); ctx.arcTo(x, y + height, x, y, radius); ctx.arcTo(x, y, x + width, y, radius); ctx.closePath(); ctx.fill();
    }
    function scene(ctx, width, height) {
        var scale = width / 960;
        ctx.save(); ctx.scale(scale, scale);
        var h = height / scale, gradient = ctx.createLinearGradient(0, 0, 960, h);
        gradient.addColorStop(0, "#414460"); gradient.addColorStop(0.55, "#2c3449"); gradient.addColorStop(1, "#181e30");
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, 960, h);
        ctx.fillStyle = "#a5b6e8"; ctx.globalAlpha = 0.1;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(650, 0); ctx.lineTo(80, h); ctx.lineTo(0, h); ctx.fill(); ctx.globalAlpha = 1;
        // Quiet architectural set, generated locally rather than downloaded media.
        for (var i = 0; i < 4; i++) {
            var x = 200 + i * 184, top = h * 0.25 - i * 12;
            ctx.fillStyle = ["#3c4160", "#495373", "#545f82", "#616a91"][i];
            ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x, top + 100); ctx.arc(x + 71, top + 100, 71, Math.PI, 0); ctx.lineTo(x + 142, h); ctx.fill();
            ctx.fillStyle = "#222a40"; ctx.beginPath(); ctx.moveTo(x + 23, h); ctx.lineTo(x + 23, top + 105); ctx.arc(x + 71, top + 105, 48, Math.PI, 0); ctx.lineTo(x + 119, h); ctx.fill();
        }
        var shade = ctx.createLinearGradient(0, h * 0.3, 0, h); shade.addColorStop(0, "#10131500"); shade.addColorStop(1, "#111719ed"); ctx.fillStyle = shade; ctx.fillRect(0, 0, 960, h);
        ctx.fillStyle = "#b7afff"; ctx.globalAlpha = 0.22;
        for (var j = 0; j < 150; j++) { ctx.fillRect((j * 173.7) % 960, (j * 71.3) % h, 1, 1); }
        ctx.restore();
    }
    function create(canvas, onTick) {
        var ctx = canvas.getContext("2d"), doc, settings, ratio = "16:9", time = 0, previous = 0;
        var playing = !root.matchMedia("(prefers-reduced-motion: reduce)").matches, frame = null;
        var reference = { width: 1920, height: 1080 };
        var fonts = Object.create(null), wordStyles = Object.create(null), previewSeed = Date.now() % 2147483647;
        function prepareStyles() {
            wordStyles = Object.create(null);
            var options = Object.assign({}, settings, {shuffleSeed: settings.shuffleSeed || previewSeed});
            var shuffler = root.KCF_WordStyles.create(options);
            doc.captions.forEach(function (caption) {
                var traits = shuffler ? shuffler.nextCaption(caption.wordIds.length) : null;
                caption.wordIds.forEach(function (id, i) { wordStyles[id] = traits ? root.KCF_WordStyles.variant(settings, traits[i]) : settings; });
            });
        }
        function dimensions() { return ratio === "9:16" ? [540, 960] : ratio === "1:1" ? [720, 720] : [960, 540]; }
        function draw() {
            if (!doc || !settings) { return; }
            var dim = dimensions();
            if (canvas.width !== dim[0] || canvas.height !== dim[1]) { canvas.width = dim[0]; canvas.height = dim[1]; }
            canvas.style.aspectRatio = dim[0] + " / " + dim[1];
            scene(ctx, dim[0], dim[1]);
            var ref = reference.width / reference.height;
            // Prefer active comp metrics only when its ratio matches this stage.
            var compWidth = Math.abs(ref - dim[0] / dim[1]) < 0.05 ? reference.width : dim[0] * 2;
            var compHeight = Math.abs(ref - dim[0] / dim[1]) < 0.05 ? reference.height : dim[1] * 2;
            var unit = dim[0] / compWidth;
            var margin = Math.min(dim[0] / 3, settings.safeMargin * unit);
            ctx.strokeStyle = "#b7afff2b"; ctx.lineWidth = 1; ctx.setLineDash([3, 5]); ctx.strokeRect(margin, margin, dim[0] - margin * 2, dim[1] - margin * 2); ctx.setLineDash([]);
            var caption = doc.captions.filter(function (c) { return time >= c.start && time < c.end; })[0];
            if (!caption) { onTick(time, doc.duration, playing, null); return; }
            var byId = Object.create(null); doc.words.forEach(function (w) { byId[w.id] = w; });
            var lines = wrap(caption.wordIds.map(function (id) { return byId[id]; }), settings);
            var baseSize = settings.fontSize * unit, size = baseSize, spacing = settings.wordSpacing * unit;
            function font(fontSize, style) {
                style = style || settings;
                var installed = fonts[style.font], family = installed ? installed.family : style.font;
                family = String(family).replace(/["\\\r\n]/g, "") || "Arial";
                if (/ArialMT/.test(family)) { family = "Arial"; }
                var face = installed ? installed.style || "" : "";
                return ((style.fauxItalic || /italic|oblique/i.test(face)) ? "italic " : "") + ((style.fauxBold || /bold|black|heavy/i.test(face)) ? "700 " : "400 ") + fontSize + 'px "' + family + '", "Segoe UI", sans-serif';
            }
            ctx.font = font(baseSize);
            var rowGap = (settings.lineHeight || settings.fontSize * 1.2) * unit;
            var baseY = dim[1] - margin - rowGap * (lines.length - 1);
            if (settings.anchorPreset === "center") { baseY = dim[1] / 2 - rowGap * (lines.length - 1) / 2; }
            if (settings.anchorPreset === "top_center") { baseY = margin + baseSize; }
            if (settings.anchorPreset === "custom") { baseY = settings.y * unit; }
            baseY += settings.verticalOffset * unit;
            lines.forEach(function (line, li) {
                size = baseSize; ctx.font = font(size);
                var texts = line.map(function (word) { return word.text + (word.punctuationAfter || ""); });
                var tracking = settings.tracking;
                function widths() { return texts.map(function (text, index) { ctx.font = font(size, wordStyles[line[index].id]); if ("letterSpacing" in ctx) { ctx.letterSpacing = "0px"; } return ctx.measureText(text).width + Math.max(0, text.length - 1) * tracking * size / 1000; }); }
                var ws = widths(), total = ws.reduce(function (a, b) { return a + b; }, 0) + spacing * (line.length - 1);
                if (settings.fitBoundary && total > 0) {
                    var room = (settings.fitWidth || compWidth - settings.safeMargin * 2) * unit - spacing * (line.length - 1);
                    size = Math.max(unit, Math.min(settings.fitMaxFontSize * unit, baseSize * Math.max(unit, room) / ws.reduce(function (a, b) { return a + b; }, 0)));
                    ws = widths();
                    var glyphs = ws.reduce(function (a, b) { return a + b; }, 0), gaps = texts.reduce(function (sum, text) { return sum + Math.max(0, text.length - 1); }, 0);
                    if (size >= settings.fitMaxFontSize * unit && glyphs < room && gaps > 0 && settings.fitMaxTracking > tracking) { tracking = Math.min(settings.fitMaxTracking, tracking + (room - glyphs) * 1000 / (size * gaps)); ws = widths(); }
                    total = ws.reduce(function (a, b) { return a + b; }, 0) + spacing * (line.length - 1);
                }
                var anchorX = settings.anchorPreset === "custom" ? settings.x * unit : dim[0] / 2;
                var x = settings.alignment === "left" ? anchorX : settings.alignment === "right" ? anchorX - total : anchorX - total / 2;
                var y = baseY + li * rowGap;
                if (settings.backgroundBox) {
                    ctx.save(); ctx.globalAlpha = settings.boxOpacity / 100;
                    ctx.fillStyle = settings.boxColor;
                    rounded(ctx, x - size * 0.3, y - size, total + size * 0.6, size * 1.4, settings.boxRadius * unit);
                    ctx.restore();
                }
                line.forEach(function (word, wi) {
                    var style = wordStyles[word.id];
                    var m = motion(settings.preset, word, caption, time, settings);
                    ctx.save(); ctx.globalAlpha = m.alpha;
                    ctx.font = font(size, style);
                    if ("letterSpacing" in ctx) { ctx.letterSpacing = tracking * size / 1000 + "px"; }
                    ctx.translate(x + ws[wi] / 2 + m.dx * unit, y - size * 0.34 + m.dy * unit); ctx.scale(m.scale, m.scale);
                    if (m.box) { ctx.fillStyle = settings.activeBoxColor; rounded(ctx, -ws[wi] / 2 - size * 0.12, -size * 0.67, ws[wi] + size * 0.24, size * 1.35, settings.boxRadius * unit); }
                    ctx.fillStyle = m.active && !m.box ? style.highlightColor : style.fillColor;
                    var shadowAngle = style.shadowAngle * Math.PI / 180;
                    var rgb = style.shadowColor.match(/\w\w/g).map(function (hex) { return parseInt(hex, 16); });
                    ctx.shadowColor = m.glow ? style.highlightColor : "rgba(" + rgb.join(",") + "," + style.shadowOpacity / 100 + ")";
                    ctx.shadowBlur = m.glow || (style.shadow ? style.shadowSoftness * unit : 0);
                    ctx.shadowOffsetX = style.shadow ? style.shadowDistance * Math.sin(shadowAngle) * unit : 0;
                    ctx.shadowOffsetY = style.shadow ? -style.shadowDistance * Math.cos(shadowAngle) * unit : 0;
                    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
                    function stroke() { ctx.strokeStyle = style.strokeColor; ctx.lineWidth = style.strokeWidth * unit; ctx.strokeText(texts[wi], 0, size * 0.34); }
                    if (style.stroke && style.strokePosition !== "center") { stroke(); }
                    if (style.fill || !style.stroke) { ctx.fillText(texts[wi], 0, size * 0.34); }
                    if (style.stroke && style.strokePosition === "center") { stroke(); }
                    ctx.restore(); x += ws[wi] + spacing;
                });
            });
            onTick(time, doc.duration, playing, caption);
        }
        function tick(now) {
            if (playing && doc && !document.hidden) { if (previous) { time = (time + Math.min((now - previous) / 1000, 0.1)) % doc.duration; } draw(); }
            previous = now; frame = root.requestAnimationFrame(tick);
        }
        frame = root.requestAnimationFrame(tick);
        return {
            set: function (document, style) { doc = document; settings = style; prepareStyles(); time = Math.min(time, doc.duration); draw(); },
            seek: function (value) { time = clamp(value, 0, doc.duration); draw(); },
            toggle: function () { playing = !playing; previous = 0; draw(); },
            restart: function () { time = 0; draw(); },
            ratio: function (value) { ratio = value; draw(); },
            context: function (comp, installedFonts) { if (comp) { reference = comp; } if (installedFonts) { fonts = Object.create(null); installedFonts.forEach(function (font) { fonts[font.name] = font; }); } draw(); },
            pause: function () { playing = false; draw(); },
            destroy: function () { root.cancelAnimationFrame(frame); }
        };
    }
    var api = { create: create, motion: motion, wrap: wrap, temporalEase: temporalEase };
    if (typeof module !== "undefined" && module.exports) { module.exports = api; } else { root.KCF_Preview = api; }
}(typeof window !== "undefined" ? window : this));
