/* Slide In preset: direction maths for the angle dial, and the
   keyframes the preset lays down on each word layer. */

const assert = require("node:assert/strict");
const test = require("node:test");

const { loadLib, build } = require("./ae_stub.js");

function near(actual, expected, what) {
    assert.ok(Math.abs(actual - expected) < 1e-9,
        `${what}: expected ~${expected}, got ${actual}`);
}

const SLIDE = {
    preset: "slide_in",
    slideAngle: 0,
    slideDistance: 200,
    slideDuration: 0.4,
    slideDolly: 0,
    slideEaseIn: 100,
    slideEaseOut: 98,
    slideMotionBlur: true
};

// --- direction maths --------------------------------------------------

test("angle 0 starts the word below its resting place, so it flies up", () => {
    const { KCF_slideOffset } = loadLib();
    const [dx, dy] = KCF_slideOffset(0, 200);

    near(dx, 0, "x offset");
    near(dy, 200, "y offset");   // comp space: +y is downward
});

test("the dial runs clockwise through left, top and right", () => {
    const { KCF_slideOffset } = loadLib();
    const cases = [
        [90, -200, 0],    // from the left
        [180, 0, -200],   // from above
        [270, 200, 0]     // from the right
    ];

    for (const [angle, ex, ey] of cases) {
        const [dx, dy] = KCF_slideOffset(angle, 200);
        near(dx, ex, `angle ${angle} x`);
        near(dy, ey, `angle ${angle} y`);
    }
});

test("a diagonal angle keeps the full slide distance", () => {
    const { KCF_slideOffset } = loadLib();
    const [dx, dy] = KCF_slideOffset(45, 200);

    near(Math.sqrt(dx * dx + dy * dy), 200, "offset magnitude");
});

test("angles past a full turn behave like their wrapped equivalent", () => {
    const { KCF_slideOffset } = loadLib();
    const [dx, dy] = KCF_slideOffset(370, 200);
    const [wx, wy] = KCF_slideOffset(10, 200);

    near(dx, wx, "wrapped x");
    near(dy, wy, "wrapped y");
});

test("the dial maps a dragged point back to the angle that produced it", () => {
    const { KCF_slideOffset, KCF_slideAngleFromPoint } = loadLib();

    for (const angle of [0, 37, 90, 145, 180, 260, 270, 359]) {
        const [dx, dy] = KCF_slideOffset(angle, 50);
        near(KCF_slideAngleFromPoint(dx, dy), angle, `round trip ${angle}`);
    }
});

// --- the preset -------------------------------------------------------

test("each word slides from its offset start to exactly its resting place", () => {
    const { precomp, doc, caption } = build(3, SLIDE);

    precomp.created.forEach((layer, i) => {
        const position = layer.transform("Position");
        assert.equal(position.keys.length, 2, `word ${i} position keys`);

        const rest = position.value;
        const [from, to] = position.keys;

        near(from.value[0], rest[0], `word ${i} start x`);
        near(from.value[1], rest[1] + 200, `word ${i} start y`);
        assert.deepEqual(Array.from(to.value), Array.from(rest),
            `word ${i} must settle exactly on its layout position`);

        const t0 = Math.max(caption.start, doc.words[i].start - 0.06);
        near(from.time, t0, `word ${i} slide start`);
        near(to.time, t0 + 0.4, `word ${i} slide end`);
    });
});

test("words fade up as they slide and are fully opaque once settled", () => {
    const { precomp } = build(3, SLIDE);

    for (const layer of precomp.created) {
        const opacity = layer.transform("Opacity");
        assert.ok(opacity.keys.length >= 2, "opacity should be keyed");
        assert.equal(opacity.keys[0].value, 0);
        assert.equal(opacity.keys[opacity.keys.length - 1].value, 100);
    }
});

test("motion blur is switched on for the layers and the comp that holds them", () => {
    const { precomp } = build(3, SLIDE);

    assert.equal(precomp.motionBlur, true, "comp motion blur");
    for (const layer of precomp.created) {
        assert.equal(layer.motionBlur, true, `word ${layer.index} motion blur`);
    }
});

test("motion blur stays off when it is not asked for", () => {
    const { precomp } = build(2, Object.assign({}, SLIDE, { slideMotionBlur: false }));

    assert.equal(precomp.motionBlur, false);
    assert.equal(precomp.created[0].motionBlur, false);
});

test("dolly scales the word in and settles it back to full size", () => {
    const { precomp } = build(2, Object.assign({}, SLIDE, { slideDolly: -25 }));

    for (const layer of precomp.created) {
        const scale = layer.transform("Scale");
        assert.equal(scale.keys.length, 2, "scale keys");
        assert.deepEqual(Array.from(scale.keys[0].value), [75, 75]);
        assert.deepEqual(Array.from(scale.keys[1].value), [100, 100]);
    }
});

test("no dolly means no scale keyframes at all", () => {
    const { precomp } = build(2, SLIDE);

    for (const layer of precomp.created) {
        assert.equal(layer.transform("Scale").keys.length, 0);
    }
});

test("ease influences are applied to the slide keyframes", () => {
    const { precomp } = build(2, SLIDE);

    for (const layer of precomp.created) {
        const eases = layer.transform("Position").eases;
        assert.equal(eases.length, 2, "both position keys should be eased");
        assert.equal(eases[0].easeIn.length, 1,
            "position is spatial, so it carries a single temporal ease");
        assert.equal(eases[0].easeIn[0].influence, 100);
        assert.equal(eases[0].easeOut[0].influence, 98);
    }
});

test("a zero distance still produces a clean settle rather than breaking", () => {
    const { precomp } = build(2, Object.assign({}, SLIDE, { slideDistance: 0 }));

    for (const layer of precomp.created) {
        const position = layer.transform("Position");
        assert.equal(position.keys.length, 2);
        assert.deepEqual(
            Array.from(position.keys[0].value),
            Array.from(position.keys[1].value)
        );
    }
});

test("Slide In is offered in the preset list", () => {
    const { KCF_PRESET_LABELS, KCF_PRESETS } = loadLib();
    const ids = KCF_PRESET_LABELS.map((entry) => entry[0]);

    assert.ok(ids.includes("slide_in"), "slide_in should be listed");
    assert.ok(KCF_PRESETS.slide_in, "slide_in should be registered");
});
