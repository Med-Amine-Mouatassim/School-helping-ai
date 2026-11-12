import { Router } from 'express';
const router = Router();
router.get('/', (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    message: 'Backend is running'
  });
});
router.get('/ai', (_req, res) => {
  res.status(503).json({
    success: false,
    status: 'engine_not_configured',
    message: 'Aucun moteur IA n’est configuré.'
  });
});
export default router;
