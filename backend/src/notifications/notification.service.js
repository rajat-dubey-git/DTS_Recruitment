export async function createNotification(executor, {
  userId,
  type,
  title,
  message,
  targetUrl,
}) {
  await executor.execute(
    `INSERT INTO notifications
      (user_id, notification_type, title, message, target_url)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, type, title, message, targetUrl],
  )
}

export async function notifyActiveCustomerContacts(executor, customerId, notification) {
  const [contacts] = await executor.execute(
    `SELECT DISTINCT cc.user_id
     FROM customer_contacts cc
     INNER JOIN users u ON u.user_id = cc.user_id
     WHERE cc.customer_id = ? AND cc.status = 'ACTIVE'
       AND u.role = 'CUSTOMER' AND u.status = 'ACTIVE'`,
    [customerId],
  )
  for (const contact of contacts) {
    await createNotification(executor, { ...notification, userId: contact.user_id })
  }
}

export async function notifyActiveAdmins(executor, notification) {
  const [admins] = await executor.execute(
    `SELECT user_id
     FROM users
     WHERE role = 'ADMIN' AND status = 'ACTIVE'`,
  )
  for (const admin of admins) {
    await createNotification(executor, { ...notification, userId: admin.user_id })
  }
}

export async function notifyAssignedRecruiters(executor, requirementId, notification) {
  const [recruiters] = await executor.execute(
    `SELECT DISTINCT ra.recruiter_id AS user_id
     FROM requirement_assignments ra
     INNER JOIN users u ON u.user_id = ra.recruiter_id
     WHERE ra.requirement_id = ? AND ra.unassigned_at IS NULL
       AND u.role = 'RECRUITER' AND u.status = 'ACTIVE'`,
    [requirementId],
  )
  for (const recruiter of recruiters) {
    await createNotification(executor, { ...notification, userId: recruiter.user_id })
  }
}
