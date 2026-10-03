# Synapse Habitat V2 — integration gates (lab only)

## Verified by operator on local emulator
- Admin booking: 20 contenders / one winner, request-id idempotency, recovery after injected failure.
- Four cross-process injected recovery phases: claim/cita injection then fresh-process verification.
- Availability Gate V1: occupied, blocked, missing, stale denied; confirmed replay.
- RTDB Admin transaction baseline: observed null in callback despite prior read; V2 transaction prototype is NOT validated.

## Pending objective evidence
- ETag CAS V2 test after fixing REST 401 with emulator-only `auth=owner`; confirm anonymous read remains 401, authenticated ETag read succeeds, 20 contenders give exactly one winner, state/slot race and replay.
- GitHub Actions emulator workflow (PR checks may not appear until GitHub recognizes the new workflow; do not count syntax-only workflow as emulator proof).
- End-to-end binding of unit claim to durable request identity, cita creation and event evidence.
- Authenticate and rate-limit HTTP booking; validate payload, status, versions and caller authorization on trusted server.
- Recovery for actual abrupt process termination and incomplete CAS claim; reclaim/reconcile orphaned claims safely.
- Scope request identity across units (CAS prototype currently only prevents reuse within a single unit); handle global agent schedule conflict separately from per-unit slot exclusivity.
- Audit RTDB rules and verify public access to personal information is denied.

## Source integration
- `reservar.html` on the lab branch blocks automatic multiunit public writes pending trusted server. Legacy reservation path remains untouched by this guard; it is NOT a security endorsement of legacy public writes.
- Do not merge the draft PR or deploy; reconcile local uncommitted `index.html` changes first.
- Never expose emulator-only `auth=owner` in browser or production code.
- Existing global `citas_publicas` schedule is not migrated; per-unit CAS is a separate synthetic namespace.
