const express = require('express');
const router = express.Router();
const supabase = require('../db/supabase');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.use(authMiddleware);

// ── GET /api/salary/rates ── 보험료율 조회
router.get('/rates', async (req, res) => {
  const { data, error } = await supabase
    .from('insurance_rates')
    .select('*')
    .order('id', { ascending: false })
    .limit(1)
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── PUT /api/salary/rates ── 보험료율 수정 (관리자만)
router.put('/rates', adminOnly, async (req, res) => {
  const { npRate, hiRate, ltRate, eiRate } = req.body;

  const { data, error } = await supabase
    .from('insurance_rates')
    .update({
      np_rate: npRate,
      hi_rate: hiRate,
      lt_rate: ltRate,
      ei_rate: eiRate,
      updated_at: new Date(),
    })
    .eq('id', 1)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── PUT /api/salary/employees/:id ── 급여 수정 (관리자만)
router.put('/employees/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const { payType, monthly, hourly } = req.body;

  const { data: before } = await supabase
    .from('employees')
    .select('pay_type, monthly, hourly')
    .eq('id', id)
    .single();

  const { data: emp, error } = await supabase
    .from('employees')
    .update({ pay_type: payType, monthly: monthly || 0, hourly: hourly || 0 })
    .eq('id', id)
    .select('id, name, pay_type, monthly, hourly')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  const amountFrom = before.pay_type === payType
    ? (payType === 'monthly' ? before.monthly : before.hourly)
    : 0;
  const amountTo = payType === 'monthly' ? monthly : hourly;

  await supabase.from('salary_history').insert({
    emp_id: id,
    changed_at: new Date().toISOString().split('T')[0],
    pay_type: payType,
    amount_from: amountFrom,
    amount_to: amountTo,
    changed_by: '관리자',
  });

  res.json(emp);
});

// ── GET /api/salary/history ── 급여 변경 이력 (관리자만)
router.get('/history', adminOnly, async (req, res) => {
  const { data, error } = await supabase
    .from('salary_history')
    .select('*, employees(name)')
    .order('changed_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ── GET /api/salary/calculate ── 급여 계산
router.get('/calculate', async (req, res) => {
  const { empId, month, year, nontax, incomeRate } = req.query;
  const targetId = req.user.isAdmin ? empId : req.user.id;

  // 직원 정보
  const { data: emp } = await supabase
    .from('employees')
    .select('name, pay_type, monthly, hourly')
    .eq('id', targetId)
    .single();

  // 해당 월 근무 기록
  const paddedMonth = String(month).padStart(2, '0');
  const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
  const from = `${year}-${paddedMonth}-01`;
  const to   = `${year}-${paddedMonth}-${lastDay}`;

  const { data: logs } = await supabase
    .from('work_logs')
    .select('hours')
    .eq('emp_id', targetId)
    .gte('date', from)
    .lte('date', to);

  const totalHours = (logs || []).reduce((s, l) => s + parseFloat(l.hours), 0);
  const gross = emp.pay_type === 'monthly' ? emp.monthly : emp.hourly * totalHours;

  // 보험료율
  const { data: rates } = await supabase
    .from('insurance_rates')
    .select('*')
    .eq('id', 1)
    .single();

  // ── 비과세 / 과세표준 계산 ──
  const nontaxTotal = parseInt(nontax) || 0;
  const taxable = Math.max(0, gross - nontaxTotal);

  // ── 4대보험 (과세표준 기준) ──
  const np = taxable * rates.np_rate / 100;
  const hi = taxable * rates.hi_rate / 100;
  const lt = hi * rates.lt_rate / 100;
  const ei = taxable * rates.ei_rate / 100;

  // ── 소득세 / 지방소득세 ──
  const incomeRateVal = parseFloat(incomeRate) || 0;
  const income = taxable * incomeRateVal / 100;
  const local  = income * 0.1;

  const totalDeduction = np + hi + lt + ei + income + local;

  res.json({
    employee: emp,
    totalHours: Math.round(totalHours * 10) / 10,
    workDays: logs?.length || 0,
    gross,
    nontaxTotal,
    taxable,
    deductions: {
      np,
      hi,
      lt,
      ei,
      income,
      local,
      total: totalDeduction,
    },
    netPay: gross - totalDeduction,
    rates,
  });
});

module.exports = router;
