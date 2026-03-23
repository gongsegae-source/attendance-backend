const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const supabase = require('../db/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// 모든 라우트에 인증 필요
router.use(authMiddleware);

// ── GET /api/employees ── 전체 직원 목록 (관리자만)
router.get('/', adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from('employees')
    .select('id, name, login_id, role, is_admin, pay_type, monthly, hourly, join_date, vac_days_total, must_change_pw')
    .order('id');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── POST /api/employees ── 직원 추가 (관리자만)
router.post('/', adminOnly, async (req, res) => {
  const { name, loginId, password, role, payType, monthly, hourly, joinDate, vacDaysTotal } = req.body;
  if (!name || !loginId || !password)
    return res.status(400).json({ error: '이름, 아이디, 비밀번호는 필수입니다.' });

  // 중복 아이디 확인
  const { data: existing } = await supabase
    .from('employees')
    .select('id')
    .eq('login_id', loginId)
    .single();
  if (existing) return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });

  const pwHash = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('employees')
    .insert({
      name,
      login_id: loginId,
      pw_hash: pwHash,
      role: role || '사원',
      is_admin: false,
      pay_type: payType || 'monthly',
      monthly: monthly || 0,
      hourly: hourly || 0,
      join_date: joinDate || null,
      vac_days_total: vacDaysTotal || 15,
      must_change_pw: false,
    })
    .select('id, name, login_id, role, pay_type, monthly, hourly, join_date, vac_days_total')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ── PUT /api/employees/:id ── 직원 정보 수정 (관리자만)
router.put('/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { name, role, payType, monthly, hourly, joinDate, vacDaysTotal } = req.body;

  const { data, error } = await supabase
    .from('employees')
    .update({ name, role, pay_type: payType, monthly, hourly, join_date: joinDate, vac_days_total: vacDaysTotal })
    .eq('id', id)
    .select('id, name, login_id, role, pay_type, monthly, hourly, join_date, vac_days_total')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── PUT /api/employees/:id/login-id ── 아이디 변경 (관리자만)
router.put('/:id/login-id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { loginId } = req.body;
  if (!loginId) return res.status(400).json({ error: '새 아이디를 입력해주세요.' });

  const { data: existing } = await supabase
    .from('employees')
    .select('id')
    .eq('login_id', loginId)
    .neq('id', id)
    .single();
  if (existing) return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });

  const { error } = await supabase
    .from('employees')
    .update({ login_id: loginId })
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: '아이디가 변경되었습니다.' });
});

// ── POST /api/employees/:id/reset-password ── 비번 초기화 (관리자만)
router.post('/:id/reset-password', adminOnly, async (req, res) => {
  const { id } = req.params;
  // 8자리 랜덤 임시 비번 생성
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let tempPw = '';
  for (let i = 0; i < 8; i++) tempPw += chars[Math.floor(Math.random() * chars.length)];

  const pwHash = await bcrypt.hash(tempPw, 10);
  const { error } = await supabase
    .from('employees')
    .update({ pw_hash: pwHash, must_change_pw: true })
    .eq('id', id);

  if (error) return res.status(500).json({ error: error.message });
  // 임시 비번을 응답으로 반환 (관리자가 직원에게 전달)
  res.json({ tempPassword: tempPw });
});

// ── DELETE /api/employees/:id ── 직원 삭제 (관리자만)
router.delete('/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: '삭제되었습니다.' });
});

module.exports = router;
