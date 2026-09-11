/* Layout tests for KCF_buildCaption: where each word layer's anchor
   point sits, and that re-anchoring never moves the words on screen. */

const assert = require("node:assert/strict");
const test = require("node:test");

const { rectFor, SETTINGS, build, leftEdge, baseline } = require("./ae_stub.js");

test("each word's anchor point sits at the horizontal centre of that word", () => {
    const { precomp } = build(3);

    for (const layer of precomp.created) {
        const rect = rectFor(layer.index);
        assert.equal(
            layer.transform("Anchor Point").value[0],
            rect.left + rect.width / 2,
            `word ${layer.index} anchor X`
        );
    }
});

test("all words in a caption share one vertical anchor so scale pops stay level", () => {
    const { precomp } = build(3);
    const anchorYs = precomp.created.map((l) => l.transform("Anchor Point").value[1]);

    assert.equal(new Set(anchorYs).size, 1, "anchor Y should be uniform");

    const tops = precomp.created.map((l) => rectFor(l.index).top);
    const heights = precomp.created.map((l) => rectFor(l.index).height);
    assert.equal(anchorYs[0], Math.min(...tops) + Math.max(...heights) / 2);
});

test("re-anchoring leaves the words exactly where they were on screen", () => {
    const { precomp, settings, pos } = build(3);
    const rects = precomp.created.map((l) => rectFor(l.index));
    const lineWidth =
        rects.reduce((sum, r) => sum + r.width, 0) +
        settings.wordSpacing * (rects.length - 1);

    let cursor = pos.x - lineWidth / 2;
    for (const layer of precomp.created) {
        assert.equal(leftEdge(layer), cursor, `word ${layer.index} left edge`);
        cursor += rectFor(layer.index).width + settings.wordSpacing;
    }
});

test("word baselines stay on the caption line after re-anchoring", () => {
    const { precomp, pos } = build(3);

    for (const layer of precomp.created) {
        assert.equal(baseline(layer), pos.y, `word ${layer.index} baseline`);
    }
});

test("active-word boxes land centred on their word", () => {
    const { precomp } = build(3, { preset: "active_word_box", popScale: 0 });

    assert.equal(precomp.shapes.length, 3, "one box per word");

    const maxH = Math.max(...precomp.created.map((l) => rectFor(l.index).height));
    const padX = Math.round(SETTINGS.fontSize * 0.28);
    const padY = Math.round(SETTINGS.fontSize * 0.18);

    precomp.shapes.forEach((box, i) => {
        assert.deepEqual(
            Array.from(box.position),
            Array.from(precomp.created[i].transform("Position").value),
            `box ${i} centre should match word centre`
        );
        assert.deepEqual(Array.from(box.size), [
            Math.ceil(rectFor(i).width + padX * 2),
            Math.ceil(maxH + padY * 2)
        ], `box ${i} size`);
    });
});

test("left-aligned multi-line captions keep their word positions", () => {
    const { precomp, settings, pos } = build(4, {
        alignment: "left",
        wordsPerLine: 2,
        lineHeight: 70
    });

    [[0, 1], [2, 3]].forEach((line, l) => {
        let cursor = pos.x;
        for (const idx of line) {
            const layer = precomp.created[idx];
            assert.equal(leftEdge(layer), cursor, `word ${idx} left edge`);
            assert.equal(baseline(layer), pos.y + l * settings.lineHeight,
                `word ${idx} baseline`);
            cursor += rectFor(idx).width + settings.wordSpacing;
        }
    });
});
