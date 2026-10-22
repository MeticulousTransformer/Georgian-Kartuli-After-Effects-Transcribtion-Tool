/* Example of a self-contained title. The renderer owns layout and metadata. */
KCF_registerTitle("soft_rise", "Soft Rise", function (layer, word, caption, style, basePos) {
    var start = word.start;
    var end = Math.min(start + 0.22, caption.end);
    layer.inPoint = start;
    layer.outPoint = caption.end;
    KCF_setKeys(KCF_prop(layer, "Opacity"), [start, end], [0, 100], false);
    var position = KCF_prop(layer, "Position");
    KCF_setKeys(position, [start, end], [[basePos[0], basePos[1] + 12], basePos], false);
    KCF_easeKeys(position, 1, 70, 90);
});
