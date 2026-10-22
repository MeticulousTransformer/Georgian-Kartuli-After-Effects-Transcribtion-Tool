# Add a new title without tangling the engine

Use `ae/titles/soft_rise.jsx` as the smallest complete example.

1. Copy [title-template.jsx.example](title-template.jsx.example) into
   `ae/titles/<your_id>.jsx`. Give it a stable unique ID using lowercase letters,
   numbers and underscores. Register with `KCF_registerTitle(id, label, hooks)`.
2. Add one entry to `panel/js/catalog.js` with the **same ID**, public name,
   engine name, category, concise description and sample phrase. Categories:
   `Clean`, `Social`, `Expressive`.
3. Add the approximation to `motion()` in `panel/js/preview.js`. Reuse existing
   motion if possible, but do not silently show a different animation.
4. Add a behavior test in `panel/tests/test_studio.js`. Test actual timing and
   keyframes with the AE stub. Catalog/engine parity is already checked there.
5. In AE, test Georgian and English, one-word captions, very short words, custom
   positions and portrait/landscape layouts. Inspect a frame during the animation,
   at rest and after the caption ends. Do not claim parity based on canvas alone.

Per-word hook receives:

```text
layer    an editable text layer, anchored at its visual center
word     normalized word: id, text, start, end, punctuationAfter, ...
caption  normalized caption: id, start, end, wordIds, ...
style    typography/effect settings; colors are RGB floats (0..1)
basePos  [x, y], the measured final center of this particular word
```

Use `KCF_prop`, `KCF_setKeys`, `KCF_easeKeys`, `KCF_highlightColorKeys` and
`KCF_scalePop` from `ae/lib/presets.jsx`. Clip animation endpoints to
`caption.end`. Keep Georgian Unicode intact. Preserve final `basePos`.

For additional shapes, register an object:

```javascript
KCF_registerTitle("my_title", "My Title", {
    perWord: function (layer, word, caption, style, basePos) { /* keyframes */ },
    after: function (precomp, layouts, caption, captionIndex, style) { /* shapes */ }
});
```

`layouts` contains `{layer, word, rect, pos, anchor}` for each word. Create shapes
inside this precomp and constrain their in/out points to the caption. Never
remove existing project items, use absolute layer indexes to find user layers,
or depend on an ASR provider.

Deletion is just as clear: remove that title file, its catalog entry and its
preview branch. The renderer, providers and installer need no changes. Existing
generated compositions are self-contained and retain their keyframes.
