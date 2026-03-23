const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, loginId, name, isAdmin }
    next();
  } catch (err) {
    return res.status(401).json({ error: '토큰이 만료되었거나 유효하지 않습니다.' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: '관리자 권한이 필요합니다.' });
  }
  next();
}

module.exports = { authMiddleware, adminOnly };
