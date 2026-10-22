/* Presentation metadata only. Real AE animations live in ae/lib/presets.jsx
   and ae/titles/. Keep IDs identical across both sides. No provider knowledge. */
(function (root) {
    "use strict";
    var titles = [
        { id: "highlight_word", name: "Highlight Word", engineName: "Highlight Word", category: "Clean", description: "Every word, right on cue. A quiet lift of color.", sample: "Make every word matter", tag: "Essential" },
        { id: "active_word_box", name: "Active Word Box", engineName: "Active Word Box", category: "Social", description: "A moving color block follows the spoken word.", sample: "Give your words the spotlight", tag: "Popular" },
        { id: "spawn_word", name: "Spawn Word-by-Word", engineName: "Spawn Word-by-Word", category: "Social", description: "Words arrive as you speak, then stay together.", sample: "One word at a time" },
        { id: "bounce_in", name: "Bounce In", engineName: "Bounce In", category: "Expressive", description: "A playful entrance with a controlled overshoot.", sample: "A little more personality" },
        { id: "slide_in", name: "Slide In", engineName: "Slide In", category: "Expressive", description: "A smooth directional entrance. Set the angle yourself.", sample: "Let the story move" },
        { id: "word_disappear", name: "Word-by-Word Disappear", engineName: "Word-by-Word Disappear", category: "Social", description: "Words arrive and fade away individually.", sample: "Here for a moment" },
        { id: "pop_karaoke", name: "Pop Karaoke", engineName: "Pop Karaoke", category: "Social", description: "Dimmed words come alive with each spoken beat.", sample: "Find your own rhythm" },
        { id: "pop_caption", name: "Caption Pop", engineName: "Caption Pop", category: "Expressive", description: "The entire caption lands with a single pop.", sample: "Say it with impact" },
        { id: "typewriter", name: "Typewriter", engineName: "Typewriter", category: "Clean", description: "A precise, word-by-word reveal. No extra movement.", sample: "The story writes itself" },
        { id: "minimal", name: "Minimal Subtitle", engineName: "Minimal Subtitle", category: "Clean", description: "Still, clear typography. Let the story do the talking.", sample: "Less motion more meaning" },
        { id: "brutalist", name: "Brutalist Georgian", engineName: "Brutalist Georgian", category: "Expressive", description: "Hard color cuts with a direct, confident presence.", sample: "Words with a point" },
        { id: "neon_pulse", name: "Neon Pulse", engineName: "Neon Pulse", category: "Expressive", description: "A glow and a pulse for late-night energy.", sample: "Light up the night" },
        { id: "soft_rise", name: "Soft Rise", engineName: "Soft Rise", category: "Clean", description: "A soft fade and a small rise. Deliberately understated.", sample: "A softer kind of statement", tag: "New" }
    ];
    var api = { all: titles, get: function (id) { return titles.filter(function (title) { return title.id === id; })[0]; } };
    if (typeof module !== "undefined" && module.exports) { module.exports = api; }
    else { root.KCF_Titles = api; }
}(this));
