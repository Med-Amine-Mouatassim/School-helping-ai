import { Router } from 'express';
import { chat, prepareContext, saveChatHistory } from '../controllers/assistant.controller.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
const router = Router();
router.post('/chat', authMiddleware, chat);
router.post('/context', authMiddleware, prepareContext);
router.post('/history', authMiddleware, saveChatHistory);
export default router;
