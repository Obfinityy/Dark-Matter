// Instant finding notifications (owner order 24 Oct 2026): the bell the
// account user + admin watch. The hunt owner sees their own hunts'
// verified-finding records; admins see every record. Reads never leak
// another user's hunts (listNotificationsFor filters by owner/admin).

import express from 'express';
import { requireAuth } from './auth.js';
import { listNotificationsFor, markNotificationRead, unreadCountFor } from '../notifications.js';

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const notifications = listNotificationsFor(req.user);
  const unread = notifications.filter((n) => !(n.readBy || []).includes(req.user.id)).length;
  res.json({ ok: true, notifications: notifications.slice(0, 50), unreadCount: unread });
});

router.post('/:id/read', requireAuth, (req, res) => {
  const ok = markNotificationRead(req.params.id, req.user);
  if (!ok) return res.status(404).json({ ok: false, error: 'notification_not_found' });
  res.json({ ok: true, unreadCount: unreadCountFor(req.user) });
});

export default router;
