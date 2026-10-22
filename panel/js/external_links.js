/* Only known setup pages can leave the panel. Never include credentials in URLs. */
(function (root) {
    "use strict";
    function open(url) {
        if (root.KCF_ProviderGuide.urls.indexOf(url) < 0) { throw new Error("This setup link is not allowed."); }
        if (root.cep && root.cep.util && typeof root.cep.util.openURLInDefaultBrowser === "function") {
            var result = root.cep.util.openURLInDefaultBrowser(url);
            if (result && result.err) { throw new Error("Your browser could not open. Visit " + url); }
        } else if (root.__adobe_cep__) {
            throw new Error("Your browser could not open. Visit " + url);
        } else {
            var opened = root.open(url, "_blank", "noopener,noreferrer");
            // With noopener, browsers may return null even when the tab opens.
            if (opened) { opened.opener = null; }
        }
    }
    root.KCF_ExternalLinks = { open: open };
}(window));
