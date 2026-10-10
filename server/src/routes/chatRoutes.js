import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import {
  createConversation,
  deleteMessage,
  editMessage,
  listConversations,
  listMessages,
  listUsers,
  sendMessage,
  listStatuses,
  createStatus,
  viewStatus
} from '../controllers/chatController.js';

const router = Router();
router.use(protect);
router.get('/users', listUsers);
router.get('/conversations', listConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:id/messages', listMessages);
router.post('/conversations/:id/messages', sendMessage);
router.patch('/conversations/:id/messages/:messageId', editMessage);
router.delete('/conversations/:id/messages/:messageId', deleteMessage);

router.get('/statuses', listStatuses);
router.post('/statuses', createStatus);
router.post('/statuses/:id/view', viewStatus);

export default router;
