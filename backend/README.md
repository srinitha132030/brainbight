# API and optional gesture service

The Express API has no authentication and stores command history under a shared `local-demo` profile. Its endpoints and the web/admin workspaces are intended only for local development. Do not expose this API to the internet or store private data in it without adding appropriate authentication and authorization.

`GET /health` reports API and PostgreSQL status. Configure `DATABASE_URL` from the root `.env.example` to enable database-backed endpoints. `/api/me`, `/api/commands` (POST), and `/api/commands` (GET) use the shared demo profile.

The `gesture_service` FastAPI endpoint is an optional isolated endpoint for local development. It reports unavailable when MediaPipe or a hand-landmark model is absent; set `BRAINBIGHT_HAND_MODEL` to a compatible MediaPipe Tasks hand-landmarker `.task` file to enable inference. Models are not downloaded automatically. Image frames are accepted only in this explicitly started local development service and processed in memory.
