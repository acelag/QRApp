import { Router } from 'express';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { printKitchenTicket, printReceipt, printSessionReceipt, testPrinterConnection } from '../services/printerService';

const router = Router();
router.use(authenticate, requireRole('admin', 'manager', 'cashier'));

router.post('/kitchen/:orderId', async (req: AuthRequest, res) => {
  const result = await printKitchenTicket(req.user!.restaurantId as string, req.params.orderId as string);
  if (result.success) res.json({ message: result.message });
  else res.status(500).json({ error: result.message });
});

router.post('/receipt/:orderId', async (req: AuthRequest, res) => {
  const result = await printReceipt(req.user!.restaurantId as string, req.params.orderId as string);
  if (result.success) res.json({ message: result.message });
  else res.status(500).json({ error: result.message });
});

router.post('/session/:sessionId', async (req: AuthRequest, res) => {
  const result = await printSessionReceipt(req.user!.restaurantId as string, req.params.sessionId as string);
  if (result.success) res.json({ message: result.message });
  else res.status(500).json({ error: result.message });
});

router.post('/test', async (req: AuthRequest, res) => {
  const { role } = req.body as { role?: string };
  if (role !== 'receipt' && role !== 'kitchen') {
    res.status(400).json({ error: 'role must be "receipt" or "kitchen"' });
    return;
  }
  const result = await testPrinterConnection(req.user!.restaurantId!, role);
  if (result.success) res.json({ message: result.message });
  else res.status(500).json({ error: result.message });
});

export default router;
