/* Per-word style shuffling.

   Hands each word one of several "looks" (solid, highlight colour,
   hollow outline) so a caption reads as designed rather than uniform.

   Two things make it not feel like a slot machine:
     - looks are drawn from a bag holding one of each, refilled when
       empty, so no look is starved or repeated in a run;
     - a caption's pattern is re-drawn if it matches one of the last few
       captions, so the eye does not catch a cycle.

   Everything is driven by a seeded generator, so re-generating the same
   transcript with the same seed reproduces the same shuffle. */

/* Deterministic PRNG (Numerical Recipes LCG). ExtendScript cannot seed
   Math.random, and a reproducible shuffle matters when a caption gets
   re-cut and regenerated. */
function KCF_rng(seed) {
    var state = (seed >>> 0) || 1;
    return function () {
        // stays well inside 2^53, so double arithmetic is exact
        state = (1664525 * state + 1013904223) % 4294967296;
        return state / 4294967296;
    };
}

function KCF_createStyleShuffler(variants, seed, depth) {
    var pool = (variants && variants.length) ? variants.slice(0) : ["solid"];
    var rand = KCF_rng(seed);
    var historyDepth = (depth === undefined) ? 3 : depth;
    var bag = [];
    var history = [];

    function refill() {
        bag = pool.slice(0);
        for (var i = bag.length - 1; i > 0; i--) {          // Fisher-Yates
            var j = Math.floor(rand() * (i + 1));
            var swap = bag[i];
            bag[i] = bag[j];
            bag[j] = swap;
        }
    }

    /* Take the next look, preferring one that differs from the previous
       word so neighbours never share a look. */
    function draw(previous) {
        if (bag.length === 0) { refill(); }
        var index = -1;
        if (previous === null) {
            index = 0;
        } else {
            for (var i = 0; i < bag.length; i++) {
                if (bag[i] !== previous) { index = i; break; }
            }
            if (index === -1 && pool.length > 1) {
                // only the previous look is left: top the bag up rather
                // than doubling that look up against itself
                var leftovers = bag;
                refill();
                bag = bag.concat(leftovers);
                for (var k = 0; k < bag.length; k++) {
                    if (bag[k] !== previous) { index = k; break; }
                }
            }
            if (index === -1) { index = 0; }
        }
        return bag.splice(index, 1)[0];
    }

    function drawPattern(wordCount) {
        var out = [];
        var previous = null;
        for (var i = 0; i < wordCount; i++) {
            previous = draw(previous);
            out.push(previous);
        }
        return out;
    }

    function noAdjacentRepeats(pattern) {
        for (var i = 1; i < pattern.length; i++) {
            if (pattern[i] === pattern[i - 1]) { return false; }
        }
        return true;
    }

    /* Last resort when every redraw collided: swap two differing words
       to reach a pattern the recent captions have not used. Swapping
       keeps the mix of looks even, so the caption still reads right. */
    function repair(pattern) {
        for (var i = 0; i < pattern.length; i++) {
            for (var j = i + 1; j < pattern.length; j++) {
                if (pattern[i] === pattern[j]) { continue; }
                var candidate = pattern.slice(0);
                candidate[i] = pattern[j];
                candidate[j] = pattern[i];
                if (noAdjacentRepeats(candidate) && !seenRecently(candidate)) {
                    return candidate;
                }
            }
        }
        return pattern;
    }

    function seenRecently(pattern) {
        var key = pattern.join(",");
        for (var i = 0; i < history.length; i++) {
            if (history[i] === key) { return true; }
        }
        return false;
    }

    return {
        /* A look for each word of the next caption. Short captions can
           run out of distinct patterns (one word, three looks, three
           remembered captions), so this settles for the first draw
           rather than looping forever. */
        nextCaption: function (wordCount) {
            var chosen = null;
            for (var attempt = 0; attempt < 6; attempt++) {
                var pattern = drawPattern(wordCount);
                if (chosen === null) { chosen = pattern; }
                if (!seenRecently(pattern)) {
                    chosen = pattern;
                    break;
                }
            }
            if (seenRecently(chosen)) { chosen = repair(chosen); }
            history.push(chosen.join(","));
            while (history.length > historyDepth) { history.shift(); }
            return chosen;
        }
    };
}

/* "A, B ,C" -> ["A", "B", "C"], dropping blanks. */
function KCF_splitList(text) {
    var out = [];
    if (!text) { return out; }
    var parts = String(text).split(",");
    for (var i = 0; i < parts.length; i++) {
        var trimmed = parts[i].replace(/^\s+/, "").replace(/\s+$/, "");
        if (trimmed.length > 0) { out.push(trimmed); }
    }
    return out;
}

/* One word's style, derived from the panel settings plus the traits it
   was dealt. A trait is {look, font}; a bare string is read as a look.
   The base settings are never mutated. */
function KCF_variantStyle(settings, trait) {
    var look = trait, font = null;
    if (trait && typeof trait === "object") {
        look = trait.look;
        font = trait.font;
    }
    var style = {};
    for (var key in settings) {
        if (settings.hasOwnProperty(key)) { style[key] = settings[key]; }
    }
    if (font) { style.font = font; }
    if (look === "highlight") {
        style.fill = true;
        style.fillColor = settings.highlightColor;
    } else if (look === "outline") {
        style.fill = false;
        style.stroke = true;
        // an outline needs a visible edge even when Stroke is switched
        // off in the Type tab, so fall back to the fill colour
        style.strokeColor = settings.stroke
            ? settings.strokeColor : settings.fillColor;
        style.strokeWidth = settings.strokeWidth;
    } else if (look === "solid") {
        style.fill = true;
    }
    // no look at all (a fonts-only shuffle) leaves fill and stroke alone
    return style;
}

/* The shuffler a generate run should use, or null when there is nothing
   to vary. Shared by KCF_generate and the tests so the two cannot
   disagree about when shuffling applies.

   A single look or a single font is a legitimate choice: it pins every
   word to that one, which is how you get an all-outline caption. */
function KCF_shufflerFor(settings) {
    if (!settings || !settings.styleShuffle) { return null; }
    var looks = settings.shuffleVariants || [];
    var fonts = settings.shuffleFonts || [];
    if (looks.length === 0 && fonts.length === 0) { return null; }
    var seed = settings.shuffleSeed;
    if (!seed) { seed = (new Date()).getTime() % 2147483647; }
    /* Separate bags, offset seeds: a word's look and its font vary
       independently instead of marching in lockstep. */
    var lookBag = looks.length
        ? KCF_createStyleShuffler(looks, seed, 3) : null;
    var fontBag = fonts.length
        ? KCF_createStyleShuffler(fonts, seed + 7919, 3) : null;
    return {
        nextCaption: function (wordCount) {
            var lookRow = lookBag ? lookBag.nextCaption(wordCount) : null;
            var fontRow = fontBag ? fontBag.nextCaption(wordCount) : null;
            var out = [];
            for (var i = 0; i < wordCount; i++) {
                out.push({
                    look: lookRow ? lookRow[i] : null,
                    font: fontRow ? fontRow[i] : null
                });
            }
            return out;
        }
    };
}
