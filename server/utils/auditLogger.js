import AuditLog from '../models/AuditLog.js';

export const logAudit = async (req, action, details, userOverride = null) => {
  try {
    const user = userOverride || (req.user ? req.user.username : 'System');
    const ipAddress = req.ip || req.connection?.remoteAddress || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    const logEntry = await AuditLog.create({
      user,
      action,
      details,
      ipAddress,
      userAgent
    });

    const io = req.app?.get('io');
    if (io) {
      io.emit('audit_log_created', logEntry);
    }
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};
