import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pg from 'pg';
import { auth } from 'express-oauth2-jwt-bearer';

const { Pool } = pg;
const app = express();
const port = Number(process.env.API_PORT || 4000);
const allowedOrigins = [process.env.ADMIN_ORIGIN, process.env.WEB_ORIGIN].filter(Boolean);
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin(origin, done) { if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return done(null, true); done(new Error('Origin is not allowed')); } }));
app.use(express.json({ limit: '256kb' }));

const authConfigured = Boolean(process.env.AUTH0_DOMAIN && process.env.AUTH0_AUDIENCE && !process.env.AUTH0_DOMAIN.startsWith('your-'));
const requireAuth = authConfigured ? auth({ audience: process.env.AUTH0_AUDIENCE, issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/` }) : (req, res) => res.status(503).json({ error: 'Authentication is not configured. Set AUTH0_DOMAIN and AUTH0_AUDIENCE in .env.' });
const requireDatabase = (req, res, next) => pool ? next() : res.status(503).json({ error: 'Database is not configured. Start PostgreSQL and set DATABASE_URL in .env.' });
const userId = req => req.auth?.payload?.sub;

app.get('/health', async (_req, res) => {
  let database = 'not configured';
  if (pool) { try { await pool.query('SELECT 1'); database = 'connected'; } catch { database = 'unavailable'; } }
  res.status(database === 'unavailable' ? 503 : 200).json({ service: 'brainbight-api', status: database === 'unavailable' ? 'degraded' : 'ok', database, authentication: authConfigured ? 'configured' : 'demo-only' });
});

app.get('/api/me', requireAuth, requireDatabase, async (req, res, next) => {
  try {
    const id = userId(req);
    if (!id) return res.status(401).json({ error: 'The access token does not include a user subject.' });
    const { name, email } = req.auth.payload;
    const result = await pool.query(`INSERT INTO profiles (id, display_name, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, profiles.display_name), email = COALESCE(EXCLUDED.email, profiles.email), updated_at = NOW() RETURNING id, display_name, email, role, created_at`, [id, typeof name === 'string' ? name : null, typeof email === 'string' ? email : null]);
    res.json({ profile: result.rows[0] });
  } catch (error) { next(error); }
});

app.post('/api/commands', requireAuth, requireDatabase, async (req, res, next) => {
  try {
    const { command, action } = req.body ?? {};
    const actions = new Set(['open_app', 'go_back', 'scroll_up', 'scroll_down', 'swipe_left', 'swipe_right', 'unknown']);
    if (typeof command !== 'string' || command.trim().length < 1 || command.trim().length > 120 || !actions.has(action)) return res.status(400).json({ error: 'Provide a command (1–120 characters) and a supported action.' });
    const id = userId(req);
    if (!id) return res.status(401).json({ error: 'The access token does not include a user subject.' });
    await pool.query('INSERT INTO profiles (id, display_name, email) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING', [id, req.auth.payload.name ?? null, req.auth.payload.email ?? null]);
    const { rows } = await pool.query('INSERT INTO command_events (user_id, command, action) VALUES ($1, $2, $3) RETURNING id, command, action, created_at', [id, command.trim(), action]);
    res.status(201).json({ event: rows[0] });
  } catch (error) { next(error); }
});

app.get('/api/commands', requireAuth, requireDatabase, async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const { rows } = await pool.query('SELECT id, command, action, created_at FROM command_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId(req), limit]);
    res.json({ events: rows });
  } catch (error) { next(error); }
});

app.use((error, _req, res, _next) => {
  console.error('Request failed:', error.message);
  const status = error.statusCode ?? error.status ?? 500;
  res.status(status).json({ error: status >= 500 ? 'The request could not be completed.' : error.message });
});

const server = app.listen(port, () => console.log(`Brainbight API ready at http://localhost:${port}`));
async function shutdown() { server.close(); if (pool) await pool.end(); }
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
