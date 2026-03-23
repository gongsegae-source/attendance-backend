const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../db/supabase');
const { authMiddleware } = require('../middleware/auth');

// ── POST /api/auth/login ──────────────────────────
router.post('/login', async (req, res) => {
  const { loginId, password } = req.body;
  if (!loginId || !password)
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });

  const { data: emp, error } = await supabase
    .from('employees')
    .select('*')
    .eq('login_id', loginId)
    .single();

  if (error || !emp)
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });

  const match = await bcrypt.compare(password, emp.pw_hash);
  if (!match)
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });

  const token = jwt.sign(
    { id: emp.id, loginId: emp.login_id, name: emp.name, isAdmin: emp.is_admin },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    user: {
      id: emp.id,
      name: emp.name,
      loginId: emp.login_id,
      role: emp.role,
      isAdmin: emp.is_admin,
      mustChangePw: emp.must_change_pw,
    },
  });
});

// ── POST /api/auth/change-password ───────────────
router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요.' });
  if (newPassword.length < 4)
    return res.status(400).json({ error: '비밀번호는 4자 이상이어야 합니다.' });

  const { data: emp } = await supabase
    .from('employees')
    .select('pw_hash')
    .eq('id', req.user.id)
    .single();

  const match = await bcrypt.compare(currentPassword, emp.pw_hash);
  if (!match)
    return res.status(401).json({ error: '현재 비밀번호가 올바르지 않습니다.' });

  const newHash = await bcrypt.hash(newPassword, 10);
  await supabase
    .from('employees')
    .update({ pw_hash: newHash, must_change_pw: false })
    .eq('id', req.user.id);

  res.json({ message: '비밀번호가 변경되었습니다.' });
});

// ── GET /api/auth/me ──────────────────────────────
router.get('/me', authMiddleware, async (req, res) => {
  const { data: emp } = await supabase
    .from('employees')
    .select('id, name, login_id, role, is_admin, must_change_pw')
    .eq('id', req.user.id)
    .single();
  res.json(emp);
});

module.exports = router;
