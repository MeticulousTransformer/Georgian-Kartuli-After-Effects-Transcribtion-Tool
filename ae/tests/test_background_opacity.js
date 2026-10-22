const assert = require("node:assert/strict");
const test = require("node:test");
const {build} = require("./ae_stub");

test("caption box opacity accepts 0, partial and solid values without fading words", () => {
    const baseline = build(3,{backgroundBox:false}).precomp;
    for (const opacity of [0, 35, 100]) {
        const {precomp, caption} = build(3, {backgroundBox:true, boxColor:[0,0,0], boxOpacity:opacity});
        assert.equal(precomp.shapes.length,1);
        const box = precomp.shapes[0];
        assert.equal(box.transform("Opacity").value,opacity);
        assert.equal(box.inPoint,caption.start); assert.equal(box.outPoint,caption.end);
        precomp.created.forEach((word,index) => {
            const expected = baseline.created[index].transform("Opacity");
            assert.equal(word.transform("Opacity").value,expected.value);
            assert.deepEqual(word.transform("Opacity").keys,expected.keys);
        });
    }
});

test("old looks default to a solid box and out-of-range values stay within 0–100", () => {
    for (const [value, expected] of [[undefined,100],[NaN,100],[-10,0],[200,100]]) {
        const {precomp} = build(2, {backgroundBox:true,boxColor:[0,0,0],boxOpacity:value});
        assert.equal(precomp.shapes[0].transform("Opacity").value,expected);
    }
    assert.equal(build(2,{backgroundBox:false,boxOpacity:35}).precomp.shapes.length,0);
});
