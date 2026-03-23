-- =====================================================
-- 근태관리 시스템 DB 스키마
-- Supabase SQL Editor에 그대로 붙여넣고 실행하세요
-- =====================================================

-- 1. 직원 테이블
CREATE TABLE employees (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  login_id    TEXT NOT NULL UNIQUE,
  pw_hash     TEXT NOT NULL,             -- bcrypt 해시
  role        TEXT NOT NULL DEFAULT '사원',
  is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  pay_type    TEXT NOT NULL DEFAULT 'monthly' CHECK (pay_type IN ('monthly','hourly')),
  monthly     INTEGER NOT NULL DEFAULT 0,
  hourly      INTEGER NOT NULL DEFAULT 0,
  join_date   DATE,
  vac_days_total INTEGER NOT NULL DEFAULT 15,
  must_change_pw BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 관리자 계정 (초기 1명)
-- 비밀번호 'admin1234' 의 bcrypt 해시 (rounds=10)
INSERT INTO employees (name, login_id, pw_hash, role, is_admin, pay_type)
VALUES (
  '관리자',
  'admin',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- 실제 서비스 전 반드시 변경!
  '관리자',
  TRUE,
  'monthly'
);

-- 3. 근태 기록 테이블
CREATE TABLE work_logs (
  id          BIGSERIAL PRIMARY KEY,
  emp_id      BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  time_in     TIME NOT NULL,
  time_out    TIME NOT NULL,
  hours       NUMERIC(4,2) NOT NULL DEFAULT 0,
  note        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(emp_id, date)   -- 하루 1개 기록 (필요시 제거 가능)
);

-- 4. 휴가 신청 테이블
CREATE TABLE vacation_requests (
  id            BIGSERIAL PRIMARY KEY,
  emp_id        BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  days          NUMERIC(4,1) NOT NULL,
  reason        TEXT DEFAULT '',
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reject_reason TEXT DEFAULT '',
  applied_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 급여 변경 이력 테이블
CREATE TABLE salary_history (
  id          BIGSERIAL PRIMARY KEY,
  emp_id      BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  changed_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  pay_type    TEXT NOT NULL,
  amount_from INTEGER NOT NULL DEFAULT 0,
  amount_to   INTEGER NOT NULL,
  changed_by  TEXT NOT NULL DEFAULT '관리자',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 보험료율 설정 테이블 (행 1개만 유지)
CREATE TABLE insurance_rates (
  id            BIGSERIAL PRIMARY KEY,
  np_rate       NUMERIC(6,4) NOT NULL DEFAULT 4.5,
  hi_rate       NUMERIC(6,4) NOT NULL DEFAULT 3.545,
  lt_rate       NUMERIC(6,4) NOT NULL DEFAULT 12.95,
  ei_rate       NUMERIC(6,4) NOT NULL DEFAULT 0.9,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO insurance_rates (np_rate, hi_rate, lt_rate, ei_rate) VALUES (4.5, 3.545, 12.95, 0.9);

-- =====================================================
-- RLS (Row Level Security) — 서비스 키 사용 시 불필요하지만
-- 보안상 활성화 권장
-- =====================================================
ALTER TABLE employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_history     ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_rates    ENABLE ROW LEVEL SECURITY;

-- service_role 키는 RLS 우회 가능하므로 백엔드에서만 사용
