import { Router } from 'express';
import { webhookController } from '../controllers/webhook.controller';
import { userController } from '../controllers/user.controller';
import { adminController } from '../controllers/admin.controller';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Webhook routes
router.post('/webhook/whatsapp', (req, res) => webhookController.handleWhapiWebhook(req, res));
router.get('/webhook/whatsapp', (req, res) => webhookController.verifyWebhook(req, res));
router.post('/webhook/status', (req, res) => webhookController.handleStatusUpdate(req, res));
router.get('/webhook/stats', (req, res) => webhookController.getWebhookStats(req, res));

// User routes
router.get('/users', (req, res) => userController.getUsers(req, res));
router.get('/users/stats', (req, res) => userController.getUserStats(req, res));
router.get('/users/:id', (req, res) => userController.getUserById(req, res));
router.put('/users/:id', (req, res) => userController.updateUser(req, res));
router.delete('/users/:id', (req, res) => userController.deleteUser(req, res));
router.post('/users/:id/message', (req, res) => userController.sendMessageToUser(req, res));
router.get('/users/:id/conversations', (req, res) => userController.getUserConversations(req, res));

// Admin routes - Dashboard
router.get('/admin/dashboard', (req, res) => adminController.getDashboardStats(req, res));

// Admin routes - Listings
router.get('/admin/listings', (req, res) => adminController.getListings(req, res));
router.get('/admin/listings/:id', (req, res) => adminController.getListingById(req, res));
router.put('/admin/listings/:id', (req, res) => adminController.updateListing(req, res));
router.delete('/admin/listings/:id', (req, res) => adminController.deleteListing(req, res));

// Admin routes - Groups
router.get('/admin/groups', (req, res) => adminController.getGroups(req, res));
router.post('/admin/groups', (req, res) => adminController.addGroup(req, res));
router.put('/admin/groups/:id', (req, res) => adminController.updateGroup(req, res));
router.delete('/admin/groups/:id', (req, res) => adminController.deleteGroup(req, res));

// Admin routes - Actions
router.post('/admin/actions/scrape', (req, res) => adminController.triggerScrape(req, res));
router.post('/admin/actions/enrich', (req, res) => adminController.triggerEnrichment(req, res));
router.post('/admin/actions/match', (req, res) => adminController.triggerMatching(req, res));

// Admin routes - Logs & Config
router.get('/admin/logs', (req, res) => adminController.getActivityLogs(req, res));
router.get('/admin/config', (req, res) => adminController.getConfig(req, res));
router.put('/admin/config', (req, res) => adminController.updateConfig(req, res));

export default router;
