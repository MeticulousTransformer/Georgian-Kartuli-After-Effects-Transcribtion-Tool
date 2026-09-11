/* Per-word style shuffling: that it is reproducible, that it does not
   fall into a visible cycle, and that leaving it off changes nothing. */

const assert = require("node:assert/strict");
const test = require("node:test");

const { loadLib, build, rectFor, SETTINGS } = require("./ae_stub.js");

const LOOKS = ["solid", "highlight", "outline"];

function shuffler(seed, depth) {
    const { KCF_createStyleShuffler } = loadLib();
    return KCF_createStyleShuffler(LOOKS, seed, depth);
}

/* `captions` patterns of `wordsPer` words each. */
function run(seed, captions, wordsPer) {
    const s = shuffler(seed);
    const out = [];
    for (let i = 0; i < captions; i += 1) {
        out.push(Array.from(s.nextCaption(wordsPer)));
    }
    return out;
}

// --- reproducibility --------------------------------------------------

test("the same seed reproduces the same shuffle", () => {
    assert.deepEqual(run(12345, 8, 3), run(12345, 8, 3));
});

test("a different seed gives a different shuffle", () => {
    assert.notDeepEqual(run(1, 8, 3), run(999, 8, 3));
});

// --- not a slot machine ----------------------------------------------

test("neighbouring words never share a look", () => {
    for (const pattern of run(7, 40, 5)) {
        for (let i = 1; i < pattern.length; i += 1) {
            assert.notEqual(pattern[i], pattern[i - 1],
                `words ${i - 1} and ${i} share a look in ${pattern.join(",")}`);
        }
    }
});

test("a caption never repeats the pattern of the previous three", () => {
    const patterns = run(42, 60, 3).map((p) => p.join(","));

    for (let i = 1; i < patterns.length; i += 1) {
        const window = patterns.slice(Math.max(0, i - 3), i);
        assert.ok(!window.includes(patterns[i]),
            `caption ${i} (${patterns[i]}) repeats one of the previous three`);
    }
});

test("no look is starved or dominant across a long run", () => {
    const counts = { solid: 0, highlight: 0, outline: 0 };
    for (const pattern of run(3, 100, 4)) {
        for (const look of pattern) { counts[look] += 1; }
    }

    const total = counts.solid + counts.highlight + counts.outline;
    for (const look of LOOKS) {
        const share = counts[look] / total;
        assert.ok(share > 0.25 && share < 0.42,
            `${look} took ${(share * 100).toFixed(1)}% of words, expected near 33%`);
    }
});

test("a run of captions does not settle into one repeating pattern", () => {
    const patterns = run(8, 30, 3).map((p) => p.join(","));

    assert.ok(new Set(patterns).size >= 5,
        `only ${new Set(patterns).size} distinct patterns across 30 captions`);
});

// --- how a look becomes a style --------------------------------------

const BASE = {
    fillColor: [1, 1, 1],
    highlightColor: [1, 0, 0],
    strokeColor: [0, 0, 0],
    strokeWidth: 7,
    stroke: false,
    fill: true
};

function variant(name, overrides) {
    const { KCF_variantStyle } = loadLib();
    return KCF_variantStyle(Object.assign({}, BASE, overrides || {}), name);
}

test("the solid look keeps the base fill", () => {
    const style = variant("solid");

    assert.equal(style.fill, true);
    assert.deepEqual(Array.from(style.fillColor), [1, 1, 1]);
});

test("the highlight look swaps in the highlight colour", () => {
    const style = variant("highlight");

    assert.equal(style.fill, true);
    assert.deepEqual(Array.from(style.fillColor), [1, 0, 0]);
});

test("the outline look is hollow with a visible edge", () => {
    const style = variant("outline");

    assert.equal(style.fill, false);
    assert.equal(style.stroke, true);
    // Stroke is off in the Type tab, so the edge borrows the fill colour
    assert.deepEqual(Array.from(style.strokeColor), [1, 1, 1]);
    assert.equal(style.strokeWidth, 7);
});

test("the outline look uses the Type tab stroke colour when there is one", () => {
    const style = variant("outline", { stroke: true, strokeColor: [0, 0, 1] });

    assert.deepEqual(Array.from(style.strokeColor), [0, 0, 1]);
});

test("deriving a look never mutates the settings it came from", () => {
    const settings = Object.assign({}, BASE);
    const { KCF_variantStyle } = loadLib();
    KCF_variantStyle(settings, "outline");

    assert.equal(settings.fill, true, "caller's settings must be untouched");
    assert.equal(settings.stroke, false);
});

// --- wired through the builder ---------------------------------------

const SHUFFLE_ON = {
    styleShuffle: true,
    shuffleVariants: LOOKS,
    shuffleSeed: 2024,
    fillColor: [1, 1, 1],
    highlightColor: [1, 0, 0],
    strokeWidth: 7
};

test("with shuffling on, one caption carries more than one look", () => {
    const { precomp } = build(6, SHUFFLE_ON);
    const looks = precomp.created.map((l) => {
        const doc = l.textDocument;
        if (!doc.applyFill) { return "outline"; }
        return doc.fillColor[0] === 1 && doc.fillColor[1] === 0 ? "highlight" : "solid";
    });

    assert.ok(new Set(looks).size > 1, `all words came out as ${looks[0]}`);
});

test("every word records the look it was given", () => {
    const { precomp } = build(6, SHUFFLE_ON);

    for (const layer of precomp.created) {
        const meta = JSON.parse(layer.comment);
        assert.ok(LOOKS.includes(meta.variant),
            `word ${layer.index} has no recorded look`);
    }
});

// --- leaving it off must change nothing -------------------------------

test("shuffling off gives every word the same style, as before", () => {
    const { precomp } = build(6, { fillColor: [1, 1, 1] });

    for (const layer of precomp.created) {
        assert.equal(layer.textDocument.applyFill, true);
        assert.deepEqual(Array.from(layer.textDocument.fillColor), [1, 1, 1]);
    }
});

test("shuffling never moves a word: layout is identical either way", () => {
    const plain = build(6, { wordsPerLine: 2 });
    const shuffled = build(6, Object.assign({ wordsPerLine: 2 }, SHUFFLE_ON));

    plain.precomp.created.forEach((layer, i) => {
        const other = shuffled.precomp.created[i];
        assert.deepEqual(
            Array.from(other.transform("Position").value),
            Array.from(layer.transform("Position").value),
            `word ${i} moved when shuffling was switched on`
        );
        assert.deepEqual(
            Array.from(other.transform("Anchor Point").value),
            Array.from(layer.transform("Anchor Point").value),
            `word ${i} anchor moved when shuffling was switched on`
        );
    });
});

test("shuffling is only off when there is nothing at all to vary", () => {
    const { KCF_shufflerFor } = loadLib();

    assert.notEqual(
        KCF_shufflerFor({
            styleShuffle: true, shuffleVariants: ["outline"], shuffleSeed: 5
        }),
        null, "a single look is a real choice, not a reason to give up");
    assert.notEqual(
        KCF_shufflerFor({
            styleShuffle: true, shuffleVariants: [],
            shuffleFonts: ["OnlyOne"], shuffleSeed: 5
        }),
        null, "a font on its own should still be applied");
    assert.equal(
        KCF_shufflerFor({ styleShuffle: true, shuffleVariants: [], shuffleFonts: [] }),
        null, "nothing selected means nothing to do");
    assert.equal(
        KCF_shufflerFor({ styleShuffle: false, shuffleVariants: LOOKS }),
        null, "the checkbox still wins");
});

test("a seed of zero still produces a working shuffle", () => {
    const { KCF_shufflerFor } = loadLib();
    const s = KCF_shufflerFor({
        styleShuffle: true, shuffleVariants: LOOKS, shuffleSeed: 0
    });

    assert.equal(s.nextCaption(4).length, 4);
});

test("word rects are measured the same regardless of look", () => {
    // point-text metrics ignore the stroke, so a hollow word occupies
    // exactly the space a filled one would
    const { precomp } = build(4, SHUFFLE_ON);

    precomp.created.forEach((layer, i) => {
        assert.equal(layer.sourceRectAtTime(0, false).width, rectFor(i).width);
    });
});

test("no position in a caption favours a particular look", () => {
    // a cycling implementation would pass the overall-distribution test
    // above while still putting the same look in slot 2 every time
    const s = shuffler(2024);
    const counts = [{}, {}, {}];
    const captions = 3000;

    for (let i = 0; i < captions; i += 1) {
        Array.from(s.nextCaption(3)).forEach((look, slot) => {
            counts[slot][look] = (counts[slot][look] || 0) + 1;
        });
    }

    counts.forEach((slot, i) => {
        for (const look of LOOKS) {
            const share = (slot[look] || 0) / captions;
            assert.ok(share > 0.29 && share < 0.38,
                `slot ${i + 1} gave ${look} ${(share * 100).toFixed(1)}%, expected near 33%`);
        }
    });
});

// --- one look only, and fonts ----------------------------------------

test("picking a single look applies it to every word", () => {
    const { precomp } = build(5, {
        styleShuffle: true,
        shuffleVariants: ["outline"],
        shuffleSeed: 5,
        strokeWidth: 7
    });

    for (const layer of precomp.created) {
        assert.equal(layer.textDocument.applyFill, false,
            `word ${layer.index} should be hollow when Outline is the only look`);
        assert.equal(layer.textDocument.applyStroke, true);
    }
});

const FONTS = ["FontA", "FontB", "FontC"];

test("fonts are drawn from the chosen set", () => {
    const { precomp } = build(6, {
        styleShuffle: true,
        shuffleVariants: ["solid"],
        shuffleFonts: FONTS,
        shuffleSeed: 11
    });

    const used = precomp.created.map((l) => l.textDocument.font);
    assert.ok(new Set(used).size > 1, `only ${used[0]} was used`);
    for (const font of used) {
        assert.ok(FONTS.includes(font), `unexpected font ${font}`);
    }
});

test("neighbouring words never share a font", () => {
    const { precomp } = build(8, {
        styleShuffle: true,
        shuffleVariants: ["solid"],
        shuffleFonts: FONTS,
        shuffleSeed: 3
    });

    const used = precomp.created.map((l) => l.textDocument.font);
    for (let i = 1; i < used.length; i += 1) {
        assert.notEqual(used[i], used[i - 1], `words ${i - 1} and ${i} share a font`);
    }
});

test("one font in the set means every word uses it", () => {
    const { precomp } = build(4, {
        styleShuffle: true,
        shuffleVariants: ["solid"],
        shuffleFonts: ["OnlyOne"],
        shuffleSeed: 5
    });

    for (const layer of precomp.created) {
        assert.equal(layer.textDocument.font, "OnlyOne");
    }
});

test("an empty font list leaves the Type tab font alone", () => {
    const { precomp } = build(4, {
        styleShuffle: true,
        shuffleVariants: ["solid", "highlight"],
        shuffleFonts: [],
        shuffleSeed: 5
    });

    for (const layer of precomp.created) {
        assert.equal(layer.textDocument.font, SETTINGS.font);
    }
});

test("fonts alone are enough to shuffle, with no look variation asked for", () => {
    const { precomp } = build(6, {
        styleShuffle: true,
        shuffleVariants: [],
        shuffleFonts: FONTS,
        shuffleSeed: 9
    });

    const used = precomp.created.map((l) => l.textDocument.font);
    assert.ok(new Set(used).size > 1, "fonts should still vary");
});

test("each word records the font it was given", () => {
    const { precomp } = build(4, {
        styleShuffle: true,
        shuffleVariants: ["solid"],
        shuffleFonts: FONTS,
        shuffleSeed: 11
    });

    for (const layer of precomp.created) {
        const meta = JSON.parse(layer.comment);
        assert.ok(FONTS.includes(meta.font), `word ${layer.index} has no recorded font`);
    }
});

test("a comma separated list becomes a font set", () => {
    const { KCF_splitList } = loadLib();

    assert.deepEqual(Array.from(KCF_splitList("A, B ,C")), ["A", "B", "C"]);
    assert.deepEqual(Array.from(KCF_splitList("  ")), []);
    assert.deepEqual(Array.from(KCF_splitList("")), []);
});
