"use strict";

const http = require("node:http");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { book } = require("./admin-booking-lab");

if (process.env.FIREBASE_DATABASE_EMULATOR_HOST !== "127.0.0.1:9100") {
  throw Error("EMULATOR_9100_REQUIRED");
}

const app =
  getApps()[0] ||
  initializeApp({
    projectId: "demo-habitat-security-lab",
    databaseURL: "https://demo-habitat-security-lab-default-rtdb.firebaseio.com"
  });

const db = getDatabase(app);

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 64 * 1024) {
        reject(Error("PAYLOAD_TOO_LARGE"));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Error("INVALID_JSON"));
      }
    });
    req.on("error", reject);
  });
}

async function handler(req, res) {
  if (req.method !== "POST" || req.url !== "/lab/book") {
    return send(res, 404, { ok: false, error: "NOT_FOUND" });
  }

  try {
    const input = await readJson(req);
    const result = await book(db, input);

    if (!result.ok && result.reason === "SLOT_TAKEN") {
      return send(res, 409, result);
    }

    return send(res, 200, result);
  } catch (err) {
    if (err.message === "IDEMPOTENCY_CONFLICT") {
      return send(res, 409, { ok: false, error: err.message });
    }

    if (
      ["LAB_REQUEST_ONLY", "LAB_SLOT_ONLY", "LAB_UNIT_ONLY", "INVALID_JSON", "PAYLOAD_TOO_LARGE"].includes(err.message)
    ) {
      return send(res, 400, { ok: false, error: err.message });
    }

    console.error(err);
    return send(res, 500, { ok: false, error: "INTERNAL_ERROR" });
  }
}

const port = Number(process.env.PORT || 8787);
const server = http.createServer(handler);

if (require.main === module) {
  server.listen(port, "127.0.0.1", () => {
    console.log("LAB booking HTTP listening on http://127.0.0.1:" + port);
  });
}

module.exports = { handler, server };
