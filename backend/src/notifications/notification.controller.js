import { pool } from '../config/db.js'

function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode })
}

export async function listNotifications(req, res, next) {
  try {
    const [notificationRows, countRows] = await Promise.all([
      pool.execute(
        `SELECT notification_id, notification_type, title, message, target_url,
                read_at, created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC, notification_id DESC
         LIMIT 50`,
        [req.authUser.user_id],
      ),
      pool.execute(
        'SELECT COUNT(*) AS unread_count FROM notifications WHERE user_id = ? AND read_at IS NULL',
        [req.authUser.user_id],
      ),
    ])
    const notifications = notificationRows[0]
    const counts = countRows[0]
    return res.json({
      notifications,
      unreadCount: Number(counts[0]?.unread_count ?? 0),
    })
  } catch (error) {
    return next(error)
  }
}

export async function markNotificationRead(req, res, next) {
  try {
    const notificationId = Number(req.params.notificationId)
    if (!Number.isSafeInteger(notificationId) || notificationId < 1) {
      throw httpError('Invalid notification ID.', 400)
    }

    await pool.execute(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
       WHERE notification_id = ? AND user_id = ?`,
      [notificationId, req.authUser.user_id],
    )
    const [rows] = await pool.execute(
      'SELECT notification_id FROM notifications WHERE notification_id = ? AND user_id = ? LIMIT 1',
      [notificationId, req.authUser.user_id],
    )
    if (!rows[0]) throw httpError('Notification not found.', 404)
    return res.json({ message: 'Notification marked as read.' })
  } catch (error) {
    return next(error)
  }
}

export async function markAllNotificationsRead(req, res, next) {
  try {
    await pool.execute(
      `UPDATE notifications
       SET read_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND read_at IS NULL`,
      [req.authUser.user_id],
    )
    return res.json({ message: 'Notifications marked as read.' })
  } catch (error) {
    return next(error)
  }
}
