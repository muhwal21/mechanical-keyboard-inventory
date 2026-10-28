import bcrypt from 'bcryptjs';
import { User } from '../models/index.js';
import { createCsrfToken } from '../middleware/csrf.js';

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function sessionOperation(req, method) {
  return new Promise((resolve, reject) => {
    req.session[method]((error) => error ? reject(error) : resolve());
  });
}

export function getCsrfToken(req, res) {
  if (!req.session.csrfToken) req.session.csrfToken = createCsrfToken();
  return res.json({ csrfToken: req.session.csrfToken });
}

export async function getCurrentUser(req, res, next) {
  try {
    if (!req.session.userId) return res.json({ user: null });
    const user = await User.findByPk(req.session.userId);
    if (!user || !user.is_active) return res.json({ user: null });
    return res.json({ user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
}

export async function login(req, res, next) {
  try {
    const email = req.body.email.toLowerCase();
    const user = await User.unscoped().findOne({ where: { email } });
    const validPassword = user && await bcrypt.compare(req.body.password, user.password_hash);
    if (!user || !user.is_active || !validPassword) {
      return res.status(401).json({ message: 'Email atau kata sandi tidak sesuai.' });
    }

    await sessionOperation(req, 'regenerate');
    req.session.userId = user.id;
    req.session.csrfToken = createCsrfToken();
    await sessionOperation(req, 'save');
    return res.json({ user: publicUser(user), csrfToken: req.session.csrfToken });
  } catch (error) {
    return next(error);
  }
}

// Self-registration always creates a staff account. Admin rights can only be granted by an
// existing admin from the user-management page, so a visitor cannot register as admin.
export async function register(req, res, next) {
  try {
    const existing = await User.unscoped().findOne({ where: { email: req.body.email } });
    if (existing) {
      return res.status(409).json({
        message: 'Email sudah terdaftar. Silakan login.',
        errors: [{ field: 'email', message: 'Email sudah terdaftar.' }],
      });
    }

    const user = await User.create({
      name: req.body.name,
      email: req.body.email,
      password_hash: await bcrypt.hash(req.body.password, 12),
      role: 'staff',
      is_active: true,
    });

    // Same as login: a fresh session id prevents session fixation.
    await sessionOperation(req, 'regenerate');
    req.session.userId = user.id;
    req.session.csrfToken = createCsrfToken();
    await sessionOperation(req, 'save');
    return res.status(201).json({ user: publicUser(user), csrfToken: req.session.csrfToken });
  } catch (error) {
    return next(error);
  }
}

export async function logout(req, res, next) {
  try {
    await sessionOperation(req, 'destroy');
    res.clearCookie(process.env.SESSION_COOKIE_NAME ?? 'keystock.sid', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
}
