require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// ── 미들웨어 ──────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(express.json());

// ── 라우터 ────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/worklogs',  require('./routes/worklogs'));
app.use('/api/vacations', require('./routes/vacations'));
app.use('/api/salary',    require('./routes/salary'));

// ── 헬스체크 ──────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── 에러 핸들러 ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

// ── 서버 시작 ─────────────────────────────────────
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`✅ 서버 실행 중: http://localhost:${PORT}`));

module.exports = app; // Vercel serverless 용
