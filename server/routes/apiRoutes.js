const { Router } = require('express');
const { requireAuth, requireAdmin } = require('../middlewares/auth');
const auth = require('../controllers/authController');
const dashboard = require('../controllers/dashboardController');
const catalog = require('../controllers/catalogController');
const serviceOrders = require('../controllers/serviceOrderController');
const certificates = require('../controllers/certificateController');
const blingOAuth = require('../controllers/blingOAuthController');

const router = Router();

router.post('/auth/login', auth.login);
router.post('/auth/register', auth.registerClient);
router.get('/auth/me', requireAuth, auth.currentUser);
router.get('/bling/oauth/start', blingOAuth.start);
router.get('/bling/oauth/callback', blingOAuth.callback);
router.get('/dashboard', requireAuth, dashboard.getDashboard);

router.get('/equipment-models', requireAuth, catalog.listModels);
router.post('/equipment-models', requireAuth, requireAdmin, catalog.createModel);
router.get('/templates', requireAuth, requireAdmin, catalog.listTemplates);
router.post('/templates', requireAuth, requireAdmin, catalog.saveTemplate);
router.get('/customers', requireAuth, requireAdmin, catalog.listCustomers);

router.get('/service-orders/:number', requireAuth, requireAdmin, serviceOrders.getServiceOrder);
router.post('/bling/orders/sync', requireAuth, requireAdmin, serviceOrders.syncServiceOrder);

router.get('/certificates', requireAuth, certificates.listCertificates);
router.post('/certificates', requireAuth, requireAdmin, certificates.issueCertificate);
router.get('/certificates/:id/pdf', requireAuth, certificates.downloadCertificatePdf);
router.get('/certificates/:id', requireAuth, certificates.getCertificate);

module.exports = router;
