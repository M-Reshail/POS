/**
 * PaymentReminder Routes
 *
 * All routes require authentication (any role: admin or worker).
 * Mounted at /api/reminders in src/index.ts.
 *
 * POST   /api/reminders        → Create a new payment reminder
 * GET    /api/reminders        → List all reminders (soonest first)
 *                                Optional: ?status=PENDING  ?retailerId=xxx
 * GET    /api/reminders/due    → PENDING reminders where dueDate <= now
 *                                (dashboard alert feed — due today + overdue)
 * PATCH  /api/reminders/:id   → Update reminder (amount / dueDate / note / status)
 * DELETE /api/reminders/:id   → Delete a reminder
 *
 * NOTE: /due MUST be registered before /:id so Express does not
 *       treat the literal string "due" as an :id param.
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import {
  createReminder,
  listReminders,
  getDueReminders,
  updateReminder,
  deleteReminder,
} from './reminder.controller';

const router = Router();

router.use(authenticate);

router.get('/due',   getDueReminders);   // ← MUST precede /:id
router.get('/',      listReminders);
router.post('/',     createReminder);
router.patch('/:id', updateReminder);
router.delete('/:id', deleteReminder);

export default router;
