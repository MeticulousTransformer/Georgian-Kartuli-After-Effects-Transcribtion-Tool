/* Minimal JSON shim for ExtendScript (based on json2.js by Douglas Crockford).
   ExtendScript has no native JSON object. */
if (typeof JSON !== "object") {
    JSON = {};
}
(function () {
    "use strict";

    var escapable = new RegExp('[\\\\\\"\\u0000-\\u001f\\u007f]', 'g');
    var meta = {
        "\b": "\\b", "\t": "\\t", "\n": "\\n", "\f": "\\f",
        "\r": "\\r", '"': '\\"', "\\": "\\\\"
    };

    function quote(string) {
        escapable.lastIndex = 0;
        return escapable.test(string)
            ? '"' + string.replace(escapable, function (a) {
                var c = meta[a];
                return typeof c === "string"
                    ? c
                    : "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4);
            }) + '"'
            : '"' + string + '"';
    }

    function str(value) {
        var i, k, v, partial;
        switch (typeof value) {
        case "string":
            return quote(value);
        case "number":
            return isFinite(value) ? String(value) : "null";
        case "boolean":
            return String(value);
        case "object":
            if (value === null) {
                return "null";
            }
            if (value instanceof Array) {
                partial = [];
                for (i = 0; i < value.length; i += 1) {
                    partial[i] = str(value[i]) || "null";
                }
                return "[" + partial.join(",") + "]";
            }
            partial = [];
            for (k in value) {
                if (Object.prototype.hasOwnProperty.call(value, k)) {
                    v = str(value[k]);
                    if (v) {
                        partial.push(quote(k) + ":" + v);
                    }
                }
            }
            return "{" + partial.join(",") + "}";
        }
        return undefined; // functions, undefined
    }

    if (typeof JSON.stringify !== "function") {
        JSON.stringify = function (value) {
            return str(value);
        };
    }

    if (typeof JSON.parse !== "function") {
        JSON.parse = function (text) {
            text = String(text);
            if (/^[\],:{}\s]*$/.test(
                text
                    .replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, "@")
                    .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, "]")
                    .replace(/(?:^|:|,)(?:\s*\[)+/g, "")
            )) {
                // eval is safe here: the regex above rejects anything that is
                // not pure JSON literals (Crockford json2 pattern). ExtendScript
                // has no native JSON.parse to use instead.
                return eval("(" + text + ")");
            }
            throw new SyntaxError("JSON.parse: invalid JSON");
        };
    }
}());
