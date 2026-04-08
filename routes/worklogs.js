const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.use(authMiddleware);

// ── GET /api/worklogs ──────────────────────────────
// 관리자: 전체 직원 / 직원: 본인 것만
router.get('/', async (req, res) => {
  const { month, year, empId } = req.query;

  let query = supabase
    .from('work_logs')
    .select('*, employees(name, role)')
    .order('date', { ascending: false });

  // 직원은 무조건 본인 것만
  if (!req.user.isAdmin) {
    query = query.eq('emp_id', req.user.id);
  } else if (empId) {
    // 관리자가 특정 직원 필터를 건 경우
    query = query.eq('emp_id', empId);
  }
  // 관리자 + empId 없음 → 전체 조회 (필터 없음)

  // 월 필터
  if (year && month) {
    const paddedMonth = String(month).padStart(2, '0');
    const from = `${year}-${paddedMonth}-01`;
    // 월 마지막 날 계산
    const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
    const to = `${year}-${paddedMonth}-${lastDay}`;
    query = query.gte('date', from).lte('date', to);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── POST /api/worklogs ── 근태 추가 ──────────────
router.post('/', async (req, res) => {
  const { empId, date, timeIn, timeOut, note } = req.body;

  if (!date || !timeIn || !timeOut)
    return res.status(400).json({ error: '날짜, 출근시간, 퇴근시간은 필수입니다.' });

  // 직원은 본인 ID 강제 적용 (empId 무시)
  const targetEmpId = req.user.isAdmin ? empId : req.user.id;

  if (!targetEmpId)
    return res.status(400).json({ error: '직원 정보가 없습니다.' });

  // 근무 시간 계산 (점심 1시간 제외)
  const [h1, m1] = timeIn.split(':').map(Number);
  const [h2, m2] = timeOut.split(':').map(Number);
  const rawHours = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60 - 1;
  const hours = parseFloat(Math.max(0, rawHours).toFixed(2));

  // 같은 날 기록이 이미 있는지 확인
  const { data: existing } = await supabase
    .from('work_logs')
    .select('id')
    .eq('emp_id', targetEmpId)
    .eq('date', date)
    .single();

  if (existing) {
    // 이미 있으면 업데이트
    const { data, error } = await supabase
      .from('work_logs')
      .update({ time_in: timeIn, time_out: timeOut, hours, note: note || '' })
      .eq('id', existing.id)
      .select('*, employees(name, role)')
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  }

  // 새로 추가
  const { data, error } = await supabase
    .from('work_logs')
    .insert({
      emp_id: targetEmpId,
      date,
      time_in: timeIn,
      time_out: timeOut,
      hours,
      note: note || '',
    })
    .select('*, employees(name, role)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ── PUT /api/worklogs/:id ── 근태 수정 ───────────
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { timeIn, timeOut, note } = req.body;

  if (!timeIn || !timeOut)
    return res.status(400).json({ error: '출근시간과 퇴근시간은 필수입니다.' });

  // 직원은 본인 기록만 수정 가능
  if (!req.user.isAdmin) {
    const { data: log } = await supabase
      .from('work_logs')
      .select('emp_id')
      .eq('id', id)
      .single();

    if (!log || log.emp_id !== req.user.id)
      return res.status(403).json({ error: '본인 기록만 수정할 수 있습니다.' });
  }

  const [h1, m1] = timeIn.split(':').map(Number);
  const [h2, m2] = timeOut.split(':').map(Number);
  const rawHours = ((h2 * 60 + m2) - (h1 * 60 + m1)) / 60 - 1;
  const hours = parseFloat(Math.max(0, rawHours).toFixed(2));

  const { data, error } = await supabase
    .from('work_logs')
    .update({ time_in: timeIn, time_out: timeOut, hours, note: note || '' })
    .eq('id', id)
    .select('*, employees(name, role)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── DELETE /api/worklogs/:id ── 근태 삭제 (관리자만)
router.delete('/:id', adminOnly, async (req, res) => {
  const { error } = await supabase
    .from('work_logs')
    .delete()
    .eq('id', req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: '삭제되었습니다.' });
});

module.exports = router;
