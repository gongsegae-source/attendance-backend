const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.use(authMiddleware);

// ── GET /api/vacations ── 휴가 목록
router.get('/', async (req, res) => {
  let query = supabase
    .from('vacation_requests')
    .select('*, employees(name, role)')
    .order('applied_at', { ascending: false });

  if (!req.user.isAdmin) {
    query = query.eq('emp_id', req.user.id);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── POST /api/vacations ── 휴가 신청 (직원)
router.post('/', async (req, res) => {
  const { type, startDate, endDate, days, reason } = req.body;
  if (!type || !startDate || !endDate)
    return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });

  const { data, error } = await supabase
    .from('vacation_requests')
    .insert({
      emp_id: req.user.id,
      type,
      start_date: startDate,
      end_date: endDate,
      days,
      reason: reason || '',
      status: 'pending',
      applied_at: new Date().toISOString().split('T')[0],
    })
    .select('*, employees(name)')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// ── PUT /api/vacations/:id/approve ── 승인 (관리자만)
router.put('/:id/approve', adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from('vacation_requests')
    .update({ status: 'approved', reject_reason: '' })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── PUT /api/vacations/:id/reject ── 반려 (관리자만)
router.put('/:id/reject', adminOnly, async (req, res) => {
  const { rejectReason } = req.body;

  const { data, error } = await supabase
    .from('vacation_requests')
    .update({ status: 'rejected', reject_reason: rejectReason || '' })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── DELETE /api/vacations/:id ── 신청 취소 (본인 pending만)
router.delete('/:id', async (req, res) => {
  const { data: vac } = await supabase
    .from('vacation_requests')
    .select('emp_id, status')
    .eq('id', req.params.id)
    .single();

  if (!vac) return res.status(404).json({ error: '신청 내역을 찾을 수 없습니다.' });
  if (!req.user.isAdmin && vac.emp_id !== req.user.id)
    return res.status(403).json({ error: '본인 신청만 취소할 수 있습니다.' });
  if (vac.status !== 'pending')
    return res.status(400).json({ error: '대기중 상태인 신청만 취소할 수 있습니다.' });

  const { error } = await supabase.from('vacation_requests').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: '취소되었습니다.' });
});

module.exports = router;
