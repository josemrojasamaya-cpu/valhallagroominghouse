const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'valhalla_secret_2026_production';

/**
 * Middleware que verifica el token JWT en cada request protegido
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado.' });
    }

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.user = verified;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Token inválido o expirado.' });
    }
}

/**
 * Middleware que verifica que el usuario sea admin
 */
function adminOnly(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acceso solo para administradores.' });
    }
    next();
}

module.exports = { authMiddleware, adminOnly, JWT_SECRET };
