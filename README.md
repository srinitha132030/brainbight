# Brainbight

An accessibility-first voice and gesture control project, set up as four independent workspaces: `web` (Next.js product site), `admin` (Next.js operator dashboard), `mobile` (Expo / React Native Android companion), and `backend` (Express API and Python gesture service). PostgreSQL runs locally with Docker Compose; OAuth login uses Auth0.

## Prerequisites

- Node.js 20 or later and npm 10 or later.
- Docker Desktop for PostgreSQL, or an existing PostgreSQL instance.
- For mobile: Expo Go on an Android phone, or Android Studio and the Android SDK.
- A configured Auth0 application for real OAuth login. Demo mode runs without credentials.

## Start the workspace

```sh
cp .env.example .env
npm install
docker compose up -d postgres
npm run dev
```

Open `http://localhost:3000`. Other workspaces run independently: `npm run dev:admin` (port 3001), `npm run dev:backend` (port 4000), and `npm run dev:mobile`. The Python vision service runs from `backend/gesture_service` with `python -m venv .venv`, then activate the environment, run `pip install -r requirements.txt`, and `uvicorn app:app --reload --port 8000`.

Copy `.env.example` to `.env`. In your Auth0 application, set the domain, client ID, client secret, and API audience, and allow `http://localhost:3000/auth/callback` and `http://localhost:3001/auth/callback` as callback URLs. Allow both local origins for web origins and logout URLs. Generate `AUTH0_SECRET` with `openssl rand -hex 32`. The web and admin apps use Auth0 Universal Login; the admin only grants access when the ID token contains the verified `https://brainbight.app/roles` claim with `admin`. See `backend/README.md` for the Action setup. Without Auth0 credentials, the public web and read-only admin demo remain available.

## Android accessibility

Install and open the Android development build, grant camera permission to use the frame preview, and enable **Brainbight gesture controls** in Android's Accessibility settings before invoking system Back or scroll actions. Android requires the user to approve its `AccessibilityService`; installing an app alone cannot grant screen-control permission. The optional camera gesture demo sends an individual still frame to the Python service when you tap **Analyze this frame**. Set up a compatible local MediaPipe model before using it. Microphone transcription is user-initiated and app-foreground only; Brainbight does not listen or record in the background. Voice app-launch commands support installed YouTube, Maps, and Camera apps. Android device control does not run on the web.

The Android development build allows cleartext HTTP for the local Python vision endpoint. Disable `usesCleartextTraffic` and use authenticated HTTPS before making a production build.

Camera frames are processed locally by the device. Do not use the vision demo to identify people or infer sensitive attributes. The Python gesture service is an independent, opt-in development endpoint; only connect it to consenting camera input.

## Structure

```
admin/                       Next.js role-aware admin dashboard
backend/                     Express API, PostgreSQL schema, Python vision endpoint
mobile/                      Expo Android companion and native accessibility service
web/                          Next.js public site and interactive browser demo
docker-compose.yml            Local PostgreSQL
```

Read `backend/README.md` and `mobile/README.md` for workspace-specific details. Configure Auth0 and PostgreSQL credentials before deploying; the included Compose database password is for local development only.
