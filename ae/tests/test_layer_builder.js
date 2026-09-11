const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
    path.join(__dirname, "..", "lib", "layer_builder.jsx"),
    "utf8"
);
const context = {};
vm.createContext(context);
vm.runInContext(source, context);

function makeWords(count) {
    const words = [];
    for (let i = 0; i < count; i += 1) {
        words.push({ text: `word${i}`, punctuationAfter: "" });
    }
    return words;
}

test("rebalances an orphan final word to meet the minimum words per line", () => {
    const lines = context.KCF_breakLines(makeWords(5), {
        wordsPerLine: 4,
        minWordsPerLine: 2,
        charsPerLine: 0
    });

    assert.deepEqual(
        JSON.parse(JSON.stringify(lines)),
        [[0, 1, 2], [3, 4]]
    );
});

test("keeps a short line when rebalancing would exceed the character limit", () => {
    const words = ["a", "a", "a", "a", "xxxxxxxxx"].map((text) => ({
        text,
        punctuationAfter: ""
    }));

    const lines = context.KCF_breakLines(words, {
        wordsPerLine: 4,
        minWordsPerLine: 2,
        charsPerLine: 10
    });

    assert.deepEqual(
        JSON.parse(JSON.stringify(lines)),
        [[0, 1, 2, 3], [4]]
    );
});
