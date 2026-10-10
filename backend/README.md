# API and optional gesture service

The Express API authenticates bearer tokens using Auth0 JWKS and stores signed-in users' command history in PostgreSQL. `GET /health` shows whether Auth0 and PostgreSQL are configured. Set the variables documented in the root `.env.example` before enabling authenticated endpoints. Provision administrator roles out-of-band using the PostgreSQL `profiles.role` column; never trust a browser-supplied role. For the separate Next.js admin dashboard, add an Auth0 post-login Action that puts the namespaced `https://brainbight.app/roles` array in the **ID token** for authorized operators. The dashboard denies admin access to sessions without the explicit `admin` role.

Example Auth0 Action:

```js
exports.onExecutePostLogin = async (event, api) => {
  const allowedAdmins = (event.secrets.BRAINBIGHT_ADMIN_EMAILS || "")
    .split(",").map(email => email.trim().toLowerCase()).filter(Boolean);
  const roles = event.user.email_verified && allowedAdmins.includes((event.user.email || "").toLowerCase())
    ? ["admin"] : ["member"];
  api.idToken.setCustomClaim("https://brainbight.app/roles", roles);
};
```

Set the Action secret `BRAINBIGHT_ADMIN_EMAILS` to a comma-separated allowlist of verified operator email addresses. Replace the sample policy with your identity provider's approved role-management policy before production.

The `gesture_service` FastAPI endpoint is an optional isolated endpoint for local development. It reports unavailable when MediaPipe or a hand-landmark model is absent; set `BRAINBIGHT_HAND_MODEL` to a compatible MediaPipe Tasks hand-landmarker `.task` file to enable inference. Models are not downloaded automatically. Image frames are accepted only in this explicitly started local development service and processed in memory.
