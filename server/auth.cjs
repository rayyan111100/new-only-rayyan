const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'unishield360-dashboard-secret-change-in-production'
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h'

if (!process.env.JWT_SECRET) {
  console.warn('⚠ JWT_SECRET not set — using default. Set JWT_SECRET in .env for production security.')
}

function login(db, username, password) {
  const user = db.getUserByUsername(username)
  if (!user) return { ok: false, error: 'Invalid username or password' }
  if (!bcrypt.compareSync(password, user.password)) return { ok: false, error: 'Invalid username or password' }

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  )
  return {
    ok: true,
    token,
    user: { id: user.id, username: user.username, role: user.role, displayName: user.displayName || user.username }
  }
}

function verifyToken(token) {
  try { return { ok: true, payload: jwt.verify(token, JWT_SECRET) } }
  catch (e) { return { ok: false, error: e.message } }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' })
  }
  const result = verifyToken(authHeader.slice(7))
  if (!result.ok) return res.status(401).json({ error: 'Invalid or expired token' })
  req.user = result.payload
  next()
}

function roleMiddleware(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' })
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: `Requires one of roles: ${roles.join(', ')}` })
    next()
  }
}

module.exports = { login, verifyToken, authMiddleware, roleMiddleware }
