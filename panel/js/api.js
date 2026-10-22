/* Local service only. The install-specific token stays in memory, never storage. */
(function (root) {
    "use strict";
    var token = "", base = "http://127.0.0.1:8765";
    function request(path, payload) {
        var headers = { "Content-Type": "application/json" };
        if (token) { headers["X-KCF-Token"] = token; }
        return fetch(base + path, { method: payload ? "POST" : "GET", headers: headers, body: payload ? JSON.stringify(payload) : undefined, credentials: "omit" }).then(function (response) {
            return response.json().then(function (result) {
                if (!response.ok) { throw new Error(typeof result.detail === "string" ? result.detail : "The local service rejected this request. Check your settings."); }
                return result;
            });
        }).catch(function (error) {
            if (error instanceof TypeError) { throw new Error("Local service is offline. Open Setup and start the service, then check the connection."); }
            throw error;
        });
    }
    root.KCF_API = { request: request, setToken: function (value) { token = value; } };
}(window));
