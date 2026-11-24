const Certificate = require('../models/Certificate');
const CertificateTemplate = require('../models/CertificateTemplate');
const ServiceOrder = require('../models/ServiceOrder');
const { certificateScope } = require('../utils/formatters');

async function getDashboard(req, res, next) {
  try {
    const scope = certificateScope(req.user);
    const [certificates, recent, templates, orders] = await Promise.all([
      Certificate.countDocuments(scope),
      Certificate.find(scope).sort({ issuedAt: -1 }).limit(5).populate('customer serviceOrder'),
      req.user.role === 'ADMIN' ? CertificateTemplate.countDocuments({ active: true }) : 0,
      req.user.role === 'ADMIN' ? ServiceOrder.countDocuments() : 0
    ]);
    return res.json({ certificates, templates, orders, recent });
  } catch (error) { return next(error); }
}

module.exports = { getDashboard };
