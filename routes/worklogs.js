const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.use(authMiddleware);

// ── GET /api/worklogs ── 근태 목록
// 관리자: 전체 / 직원: 본인 것만
router.get('/', async (req, res) => {
  const { month, year, empId } = req.query;

  let query = supabase
    .from('work_logs')
    .select('*, employees(name, role)')
    .order('date', { ascending: false });

  // 직원은 본인 것만
  if (!req.user.isAdmin) {
    query = query.eq('emp_id', req.user.id);
  } else if (empId) {
    query = query.eq('emp_id', empId);
  }

  // 월 필터
  if (year && month) {
    const from = `${year}-${String(month).padStart(2,'0')}-01`;
    const to   = `${year}-${String(month).padStart(2,'0')}-31`;
    query = query.gte('date', from).lte('date', to);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── POST /api/worklogs ── 근태 추가
router.post('/', async (req, res) => {
  const { empId, date, timeIn, timeOut, note } = req.body;

  // 직원은 본인 기록만 추가 가능
  const targetEmpId = req.user.isAdmin ? empId : req.user.id;

  // 근무 시간 계산 (점심 1시간 제외)
  const [h1, m1] = timeIn.split(':').map(Number);
  const [h2, m2] = timeOut.split(':').map(Number);
  const hours = Math.max(0, ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60 - 1);

  const { data, error } = await supabase
    .from('work_logs')
    .insert({ emp_id: targetEmpId, date, time_in: timeIn, time_out: timeOut, hours: parseFloat(hours.toFixed(2)), note: note || '' })
    .select('*, employees(name)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ── PUT /api/worklogs/:id ── 근태 수정
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { timeIn, timeOut, note, empId } = req.body;

  // 직원은 본인 것만 수정 가능
  if (!req.user.isAdmin) {
    const { data: log } = await supabase.from('work_logs').select('emp_id').eq('id', id).single();
    if (!log || log.emp_id !== req.user.id)
      return res.status(403).json({ error: '본인 기록만 수정할 수 있습니다.' });
  }

  const [h1, m1] = timeIn.split(':').map(Number);
  const [h2, m2] = timeOut.split(':').map(Number);
  const hours = Math.max(0, ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60 - 1);

  const updateData = { time_in: timeIn, time_out: timeOut, hours: parseFloat(hours.toFixed(2)), note: note || '' };
  if (req.user.isAdmin && empId) updateData.emp_id = empId;

  const { data, error } = await supabase
    .from('work_logs')
    .update(updateData)
    .eq('id', id)
    .select('*, employees(name)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── DELETE /api/worklogs/:id ── 근태 삭제 (관리자만)
router.delete('/:id', adminOnly, async (req, res) => {
  const { error } = await supabase.from('work_logs').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: '삭제되었습니다.' });
});

module.exports = router;
