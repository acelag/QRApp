import { Router } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { getLoginIcon, setLoginIcon } from '../lib/appSettings';

const router = Router();

// ── Public: app-wide branding the login page needs before auth ────────────────
router.get('/public', (_req, res) => {
  res.json({ loginIcon: getLoginIcon() });
});

// ── Admin: set the login/brand icon (base64 data URL) ─────────────────────────
router.put('/login-icon', authenticate, requireRole('admin', 'super_admin'), async (req, res) => {
  const { dataUrl } = req.body as { dataUrl?: string };
  if (!dataUrl || !/^data:image\/[a-z+]+;base64,/i.test(dataUrl)) {
    res.status(400).json({ error: 'dataUrl (image data URL) is required' });
    return;
  }
  await setLoginIcon(dataUrl);
  res.json({ loginIcon: dataUrl });
});

export default router;
