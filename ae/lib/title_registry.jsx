/* Additive title packs. One file can be removed without editing the renderer. */
function KCF_registerTitle(id, label, hooks) {
    if (!/^[a-z][a-z0-9_]*$/.test(id) || KCF_PRESETS[id]) {
        throw new Error("Title ID is invalid or already registered: " + id);
    }
    if (typeof hooks !== "function" && !(hooks && typeof hooks.perWord === "function")) {
        throw new Error("Title needs a per-word animation function: " + id);
    }
    KCF_PRESETS[id] = hooks;
    KCF_PRESET_LABELS.push([id, label]);
}

function KCF_loadTitles(folder) {
    if (!folder.exists) { return; }
    var files = folder.getFiles("*.jsx");
    files.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    for (var i = 0; i < files.length; i++) { $.evalFile(files[i]); }
}
