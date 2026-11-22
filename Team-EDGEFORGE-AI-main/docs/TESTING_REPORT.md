# GhoomoUP testing report

## Automated checks

All repository smoke tests passed after the Phase 1 changes:

| Command/check | Result |
| --- | --- |
| `node tests/admin-auth-smoke.test.js` | Passed: credential validation, origin restrictions, signed session, tamper rejection and logout. |
| `node tests/admin-login-network-smoke.test.js` | Passed: temporary network and gateway retry behavior. |
| `node tests/ai-functions-smoke.test.js` | Passed: method, missing-key, empty-message and oversized-brief handling; no Groq request was made. |
| `node tests/direct-local-impact-smoke.test.js` | Passed: transparent demo-only impact calculation. |
| `node tests/feedback-roadmap-smoke.test.js` | Passed: Supabase feedback/RLS wiring and UP destinations. |
| `node tests/ghoomoup-foundation-smoke.test.js` | Passed: destination schema, image references, route rewrite and valid/invalid/inactive scan resolution. |
| `node tests/heritage-header-smoke.test.js` | Passed: GhoomoUP identity, account menu and unique HTML IDs. |
| `node tests/yatra-planner-smoke.test.js` | Passed: active destination ordering, no invented travel times or price quotes. |
| Inline JavaScript parse with Node `vm.Script` | Passed. |
| `node --check` on all three Netlify functions | Passed. |

Run the full smoke suite from the repository root:

```powershell
Get-ChildItem tests\*.test.js | ForEach-Object { node $_.FullName }
```

## Browser checks

The app was served locally with a lightweight static server that rewrote `/scan/*` to `index.html`, matching the configured Netlify rewrite:

- Homepage loaded with all three active destinations.
- Varanasi and Ayodhya scan URLs opened the correct destination details.
- Invalid scan URL showed the unavailable-destination state and its browse-home action worked.
- Destination detail displayed category filters and the empty approved-listing state.
- Food category displayed an empty state when there were no approved listings.
- At a 320px viewport, homepage and destination detail had no horizontal document overflow after responsive corrections.
- At 390px, an injected approved listing appeared while a pending listing remained hidden; the local AI fallback referenced the approved listing and Varanasi destination data.

## Environment-limited checks

- Supabase was not reachable from the test browser (`ERR_NAME_NOT_RESOLVED`), so vendor registration, remote feedback persistence and the aggregate RPC were not live-tested. Existing offline/local fallback behavior remains available. Static-server 404s for serverless routes are expected outside Netlify Dev and do not verify deployed functions.
- No `GROQ_API_KEY` or reachable Groq endpoint was configured; remote AI success was not claimed. Only local fallback logic and function input validation were tested.
- The admin authentication function was unit-tested, but no deployed Netlify environment or production admin credentials were available.
- The QR preview renderer is an external service. Site route behavior was tested independently; no physical QR was printed or installed.
- Python's basic static server does not rewrite nested scan URLs; browser route tests used an explicit local rewrite simulator. Netlify's rewrite is declared in `netlify.toml`.

## Result

No automated smoke test failed. The remaining items are deployment integrations and production hardening, not test results being represented as successful: shared database-backed listings/inquiries, server-enforced approval, configured Supabase/Groq services, restricted AI CORS/rate limits, and physical QR deployment.
