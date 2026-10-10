import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import pg from 'pg';

const { Pool } = pg;
const app = express();
const port = Number(process.env.API_PORT || 4000);
const allowedOrigins = [process.env.ADMIN_ORIGIN, process.env.WEB_ORIGIN].filter(Boolean);
const pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
const demoUserId = 'local-demo';
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin(origin, done) { if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return done(null, true); done(new Error('Origin is not allowed')); } }));
app.use(express.json({ limit: '256kb' }));

const requireDatabase = (req, res, next) => pool ? next() : res.status(503).json({ error: 'Database is not configured. Start PostgreSQL and set DATABASE_URL in .env.' });
const ensureDemoProfile = () => pool.query(
  'INSERT INTO profiles (id, display_name) VALUES ($1, $2) ON CONFLICT (id) DO UPDATE SET updated_at = NOW() RETURNING id, display_name, email, role, created_at',
  [demoUserId, 'Local demo'],
);

app.get('/health', async (_req, res) => {
  let database = 'not configured';
  if (pool) { try { await pool.query('SELECT 1'); database = 'connected'; } catch { database = 'unavailable'; } }
  res.status(database === 'unavailable' ? 503 : 200).json({ service: 'brainbight-api', status: database === 'unavailable' ? 'degraded' : 'ok', database, mode: 'local-demo' });
});

app.get('/api/me', requireDatabase, async (_req, res, next) => {
  try {
    const result = await ensureDemoProfile();
    res.json({ profile: result.rows[0] });
  } catch (error) { next(error); }
});

app.post('/api/commands', requireDatabase, async (req, res, next) => {
  try {
    const { command, action } = req.body ?? {};
    const actions = new Set(['open_app', 'go_back', 'scroll_up', 'scroll_down', 'swipe_left', 'swipe_right', 'unknown']);
    if (typeof command !== 'string' || command.trim().length < 1 || command.trim().length > 120 || !actions.has(action)) return res.status(400).json({ error: 'Provide a command (1–120 characters) and a supported action.' });
    await ensureDemoProfile();
    const { rows } = await pool.query('INSERT INTO command_events (user_id, command, action) VALUES ($1, $2, $3) RETURNING id, command, action, created_at', [demoUserId, command.trim(), action]);
    res.status(201).json({ event: rows[0] });
  } catch (error) { next(error); }
});

app.get('/api/commands', requireDatabase, async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
    const { rows } = await pool.query('SELECT id, command, action, created_at FROM command_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [demoUserId, limit]);
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
