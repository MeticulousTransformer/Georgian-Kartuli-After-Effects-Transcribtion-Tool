/* Form adapters and the direction dial. No AE, provider or layout dependencies. */
(function (root) {
    "use strict";
    function angleFromPoint(dx, dy) {
        var value = Math.atan2(-dx, dy) * 180 / Math.PI;
        return (value + 360) % 360;
    }
    function read(control) {
        if (control.dataset.kind === "variants") {
            return Array.from(control.querySelectorAll("[data-variant]:checked")).map(function (input) { return input.dataset.variant; });
        }
        if (control.dataset.kind === "font-list") {
            return control.value.split(/[,\n]/).map(function (value) { return value.trim(); }).filter(Boolean);
        }
        if (control.type === "checkbox") { return control.checked; }
        if (control.type === "number" || control.type === "range") { return Number(control.value); }
        return control.value;
    }
    function write(control, value) {
        if (control.dataset.kind === "variants") {
            control.querySelectorAll("[data-variant]").forEach(function (input) { input.checked = value.indexOf(input.dataset.variant) >= 0; });
        } else if (control.dataset.kind === "font-list") { control.value = value.join(", "); }
        else if (control.type === "checkbox") { control.checked = value; }
        else { control.value = value; }
    }
    function fontGroups(fonts) {
        var groups = Object.create(null);
        fonts.forEach(function (font) {
            var family = font.family || font.name;
            if (!groups[family]) { groups[family] = []; }
            groups[family].push({ name: font.name, style: font.style || "Regular" });
        });
        return groups;
    }
    function mountDial(element, input) {
        var needle = element.querySelector("[data-needle]");
        function sync() {
            var angle = Number(input.value) || 0;
            needle.setAttribute("transform", "rotate(" + angle + " 60 60)");
            element.setAttribute("aria-valuenow", angle);
            element.setAttribute("aria-valuetext", angle + " degrees, direction the word arrives from");
            element.querySelector("[data-angle-label]").textContent = Math.round(angle) + "°";
            document.querySelectorAll("[data-slide-angle]").forEach(function (button) { button.setAttribute("aria-pressed", String(Number(button.dataset.slideAngle) === angle % 360)); });
        }
        function set(value) {
            input.value = Math.round((value + 360) % 360);
            input.dispatchEvent(new Event("change", { bubbles: true }));
            sync();
        }
        function point(event) {
            var rect = element.getBoundingClientRect();
            set(angleFromPoint(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2));
        }
        element.addEventListener("pointerdown", function (event) { if (element.disabled) { return; } element.setPointerCapture(event.pointerId); point(event); });
        element.addEventListener("pointermove", function (event) { if (element.hasPointerCapture(event.pointerId) && !element.disabled) { point(event); } });
        element.addEventListener("keydown", function (event) {
            var angle = Number(input.value), step = event.shiftKey ? 15 : 1;
            if (["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown", "Home", "End"].indexOf(event.key) < 0) { return; }
            event.preventDefault();
            set(event.key === "Home" ? 0 : event.key === "End" ? 359 : angle + (["ArrowRight", "ArrowUp"].indexOf(event.key) >= 0 ? step : -step));
        });
        document.querySelectorAll("[data-slide-angle]").forEach(function (button) { button.addEventListener("click", function () { set(Number(button.dataset.slideAngle)); }); });
        sync();
        return { sync: sync };
    }
    var api = { read: read, write: write, angleFromPoint: angleFromPoint, fontGroups: fontGroups, mountDial: mountDial };
    if (typeof module !== "undefined" && module.exports) { module.exports = api; } else { root.KCF_DesignControls = api; }
}(typeof window !== "undefined" ? window : this));
