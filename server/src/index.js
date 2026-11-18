import express from 'express';
import cookieParser from 'cookie-parser';
import { waitForDb } from './db.js';
import { migrate } from './services/migrate.js';
import { seedContent, promoteAdmins } from './services/seed.js';
import { seedChallenges } from './services/challenges.js';
import { seedAssessments } from './services/assessments.js';
import { seedProjects } from './services/projects.js';
import projectRoutes from './routes/projects.js';
import certificateRoutes from './routes/certificates.js';
import portfolioRoutes from './routes/portfolio.js';
import achievementRoutes from './routes/achievements.js';
import leaderboardRoutes from './routes/leaderboard.js';
import profileRoutes from './routes/profile.js';
import { purgeTokens } from './services/authTokens.js';
import aiRoutes from './routes/ai.js';
import adminRoutes from './routes/admin.js';
import forumRoutes from './routes/forum.js';
import authRoutes from './routes/auth.js';
import learningRoutes from './routes/learning.js';
import compilerRoutes, { sharedRouter } from './routes/compiler.js';
import dashboardRoutes from './routes/dashboard.js';
import practiceRoutes from './routes/practice.js';
import assessmentRoutes from './routes/assessments.js';

const app = express();
// Behind Vercel / a hosting proxy, trust one hop so rate limits and cookies see the real client.
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
app.disable('x-powered-by');
// Dataset uploads carry up to 500 KB of text; everything else stays small.
app.use('/api/compiler/datasets', express.json({ limit: '700kb' }));
app.use(express.json({ limit: '400kb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
// Mounted before learningRoutes: that router guards every /api path, and these two have public endpoints.
app.use('/api/certificates', certificateRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/shared', sharedRouter);
app.use('/api', learningRoutes);
app.use('/api/compiler', compilerRoutes);
app.use('/api/practice', practiceRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/achievements', achievementRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/forum', forumRoutes);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Express 5 forwards rejected async handlers here.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

process.on('unhandledRejection', (e) => console.error('Unhandled rejection:', e));

const port = Number(process.env.PORT || 4000);
await waitForDb();
await migrate();
await seedContent();
await seedChallenges();
await seedAssessments();
await seedProjects();
await promoteAdmins();
await purgeTokens();
app.listen(port, () => console.log(`TorchLab API listening on :${port}`));
