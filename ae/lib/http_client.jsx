/* HTTP client for ExtendScript. Two transports:
   1. curl via system.callSystem (default — reliable; ships with macOS and
      Windows 10 1803+)
   2. raw Socket fallback (if curl missing)
   UTF-8 safe: request/response bodies travel through temp files. */

function KCF_utf8Encode(str) {
    return unescape(encodeURIComponent(str));
}

function KCF_utf8Decode(bytes) {
    try {
        return decodeURIComponent(escape(bytes));
    } catch (e) {
        return bytes; // not valid UTF-8, return as-is
    }
}

var KCF_curlChecked = null;
function KCF_hasCurl() {
    if (KCF_curlChecked === null) {
        try {
            var out = system.callSystem(
                ($.os.indexOf("Windows") === 0 ? "cmd /c curl --version"
                                               : "curl --version"));
            KCF_curlChecked = (out && out.indexOf("curl") !== -1);
        } catch (e) {
            KCF_curlChecked = false;
        }
    }
    return KCF_curlChecked;
}

function KCF_readFileUTF8(file) {
    file.encoding = "UTF-8";
    file.open("r");
    var text = file.read();
    file.close();
    return text;
}

/* ---- transport 1: curl ---- */
function KCF_httpViaCurl(method, host, port, path, body) {
    var tmpDir = Folder.temp.fsName;
    var outFile = new File(tmpDir + "/kcf_http_out.json");
    var codeFile = new File(tmpDir + "/kcf_http_code.txt");
    var inFile = null;
    var url = "http://" + host + ":" + port + path;

    var cmd = 'curl -s -m 1800 -X ' + method +
        ' -H "Content-Type: application/json"' +
        ' -o "' + outFile.fsName + '"' +
        ' -w "%{http_code}"' ;
    if (body) {
        inFile = new File(tmpDir + "/kcf_http_in.json");
        inFile.encoding = "UTF-8";
        inFile.open("w");
        inFile.write(body);
        inFile.close();
        cmd += ' --data-binary @"' + inFile.fsName + '"';
    }
    cmd += ' "' + url + '"';
    if ($.os.indexOf("Windows") === 0) {
        cmd = 'cmd /c ' + cmd + ' > "' + codeFile.fsName + '"';
    } else {
        cmd = cmd + ' > "' + codeFile.fsName + '"';
        cmd = "/bin/sh -c '" + cmd.replace(/'/g, "'\\''") + "'";
    }

    if (outFile.exists) { outFile.remove(); }
    if (codeFile.exists) { codeFile.remove(); }
    system.callSystem(cmd);

    var statusText = codeFile.exists ? KCF_readFileUTF8(codeFile) : "";
    var status = parseInt(statusText.replace(/\s/g, ""), 10);
    if (!outFile.exists || isNaN(status) || status === 0) {
        throw new Error("Backend not running. Start backend with `python backend/app.py` " +
            "(or run_backend.sh) and check http://" + host + ":" + port + "/health in a browser.");
    }
    var text = KCF_readFileUTF8(outFile);
    return { status: status, text: text };
}

/* ---- transport 2: raw socket ---- */
function KCF_httpViaSocket(method, host, port, path, body) {
    var bodyBytes = body ? KCF_utf8Encode(body) : "";
    var request =
        method + " " + path + " HTTP/1.1\r\n" +
        "Host: " + host + ":" + port + "\r\n" +
        "Content-Type: application/json\r\n" +
        "Content-Length: " + bodyBytes.length + "\r\n" +
        "Accept: application/json\r\n" +
        "Connection: close\r\n" +
        "\r\n" +
        bodyBytes;

    var socket = new Socket();
    socket.timeout = 1800;
    if (!socket.open(host + ":" + port, "BINARY")) {
        throw new Error("Backend not running. Start backend with `python backend/app.py`.");
    }
    var response = "";
    var deadline = new Date().getTime() + 1800 * 1000;
    try {
        socket.write(request);
        while (socket.connected && !socket.eof) {
            if (new Date().getTime() > deadline) {
                throw new Error("Backend request timed out.");
            }
            var chunk = socket.read(65536);
            if (chunk !== null && chunk.length > 0) {
                response += chunk;
            }
            // early exit once Content-Length worth of body has arrived
            var sepIdx = response.indexOf("\r\n\r\n");
            if (sepIdx !== -1) {
                var m = response.substring(0, sepIdx).match(/content-length:\s*(\d+)/i);
                if (m && response.length >= sepIdx + 4 + parseInt(m[1], 10)) {
                    break;
                }
            }
        }
    } finally {
        socket.close();
    }
    var sep = response.indexOf("\r\n\r\n");
    if (sep === -1) {
        throw new Error("Bad HTTP response from backend.");
    }
    var head = response.substring(0, sep);
    var rawBody = response.substring(sep + 4);
    if (/transfer-encoding:\s*chunked/i.test(head)) {
        var out = "";
        var pos = 0;
        while (pos < rawBody.length) {
            var lineEnd = rawBody.indexOf("\r\n", pos);
            if (lineEnd === -1) { break; }
            var size = parseInt(rawBody.substring(pos, lineEnd), 16);
            if (isNaN(size) || size === 0) { break; }
            out += rawBody.substr(lineEnd + 2, size);
            pos = lineEnd + 2 + size + 2;
        }
        rawBody = out;
    }
    return {
        status: parseInt(head.split(" ")[1], 10),
        text: KCF_utf8Decode(rawBody)
    };
}

/* KCF_httpJSON("POST", "127.0.0.1", 8765, "/transcribe", {..}) -> parsed JSON.
   Throws Error with a useful message on failure. */
function KCF_httpJSON(method, host, port, path, bodyObj) {
    var body = bodyObj ? JSON.stringify(bodyObj) : "";
    var resp = KCF_hasCurl()
        ? KCF_httpViaCurl(method, host, port, path, body)
        : KCF_httpViaSocket(method, host, port, path, body);

    var json;
    try {
        json = JSON.parse(resp.text);
    } catch (e) {
        throw new Error("Backend returned non-JSON (HTTP " + resp.status + "): " +
            String(resp.text).substring(0, 300));
    }
    if (resp.status >= 400) {
        throw new Error(json.detail ? String(json.detail)
            : ("HTTP " + resp.status + ": " + String(resp.text).substring(0, 300)));
    }
    return json;
}
