import { notifyActiveCustomerContacts } from '../notifications/notification.service.js'

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

export async function createCustomerResumeShare(connection, applicationId, sharedByUserId) {
  const [applications] = await connection.execute(
    `SELECT a.application_id, a.requirement_id, a.candidate_id, a.recruiter_id,
            agreement.customer_id
     FROM applications a
     INNER JOIN job_requirements r ON r.requirement_id = a.requirement_id
     INNER JOIN service_orders so ON so.service_order_id = r.service_order_id
     INNER JOIN agreements agreement ON agreement.agreement_id = so.agreement_id
     WHERE a.application_id = ?
     LIMIT 1
     FOR UPDATE`,
    [applicationId],
  )
  const application = applications[0]
  if (!application) throw httpError(404, 'Application not found.')

  const [consents] = await connection.execute(
    `SELECT candidate_consent_id
     FROM candidate_consents
     WHERE candidate_id = ? AND requirement_id = ? AND customer_id = ?
       AND withdrawn_at IS NULL
     LIMIT 1`,
    [application.candidate_id, application.requirement_id, application.customer_id],
  )
  if (!consents[0]) {
    return { shareId: null, reason: 'Active candidate consent is required before sharing.' }
  }

  const [activeShares] = await connection.execute(
    `SELECT share_id
     FROM resume_shares
     WHERE application_id = ? AND status IN ('SHARED', 'VIEWED')
       AND access_expires_at > CURRENT_TIMESTAMP
     ORDER BY share_id DESC
     LIMIT 1
     FOR UPDATE`,
    [applicationId],
  )
  if (activeShares[0]) {
    return { shareId: Number(activeShares[0].share_id), alreadyShared: true }
  }

  const [contacts] = await connection.execute(
    `SELECT cc.contact_id
     FROM customer_contacts cc
     INNER JOIN users u ON u.user_id = cc.user_id
     WHERE cc.customer_id = ? AND cc.status = 'ACTIVE'
       AND u.role = 'CUSTOMER' AND u.status = 'ACTIVE'
     ORDER BY cc.is_primary DESC, cc.contact_id
     LIMIT 1`,
    [application.customer_id],
  )
  if (!contacts[0]) {
    return { shareId: null, reason: 'No active customer contact is available to receive the share.' }
  }

  const [documents] = await connection.execute(
    `SELECT document_id
     FROM candidate_documents
     WHERE candidate_id = ? AND document_type = 'RESUME' AND is_current = 1
       AND verification_status = 'VERIFIED' AND malware_scan_status = 'CLEAN'
     ORDER BY uploaded_at DESC
     LIMIT 1`,
    [application.candidate_id],
  )
  if (!documents[0]) {
    return {
      shareId: null,
      reason: 'Sharing is pending administrator verification and a clean security scan of the current resume.',
    }
  }

  const [result] = await connection.execute(
    `INSERT INTO resume_shares
      (application_id, shared_with_contact_id, document_id, shared_by, access_expires_at, status)
     VALUES (?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 24 HOUR), 'SHARED')`,
    [applicationId, contacts[0].contact_id, documents[0].document_id, sharedByUserId],
  )
  const shareId = Number(result.insertId)

  await connection.execute(
    `INSERT INTO resume_share_events (share_id, event_code, actor_user_id)
     VALUES (?, 'CREATED', ?)`,
    [shareId, sharedByUserId],
  )
  await notifyActiveCustomerContacts(connection, Number(application.customer_id), {
    type: 'CANDIDATE_SHARED',
    title: 'Candidate profile shared',
    message: 'A candidate profile and verified resume are available for your organization to review.',
    targetUrl: '/app/candidates',
  })

  return { shareId, alreadyShared: false }
}

export async function shareEligibleCandidateApplications(connection, candidateId, sharedByUserId) {
  const [applications] = await connection.execute(
    `SELECT a.application_id
     FROM applications a
     INNER JOIN job_requirements r ON r.requirement_id = a.requirement_id
     WHERE a.candidate_id = ? AND a.source = 'RECRUITER_ADDED'
       AND a.status IN ('APPLIED', 'SCREENING', 'SHORTLISTED', 'INTERVIEW')
       AND r.status = 'OPEN'
       AND EXISTS (
         SELECT 1
         FROM candidate_consents consent
         INNER JOIN service_orders so ON so.service_order_id = r.service_order_id
         INNER JOIN agreements agreement ON agreement.agreement_id = so.agreement_id
         WHERE consent.candidate_id = a.candidate_id
           AND consent.requirement_id = a.requirement_id
           AND consent.customer_id = agreement.customer_id
           AND consent.withdrawn_at IS NULL
       )
     ORDER BY a.application_id
     FOR UPDATE`,
    [candidateId],
  )

  let sharedCount = 0
  for (const application of applications) {
    const result = await createCustomerResumeShare(
      connection,
      Number(application.application_id),
      sharedByUserId,
    )
    if (result.shareId && !result.alreadyShared) sharedCount += 1
  }
  return sharedCount
}
