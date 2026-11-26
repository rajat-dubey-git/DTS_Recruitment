import { pool } from '../config/db.js'
import { getCandidateProfileForUser } from '../candidate/account-link.service.js'

function count(value) {
  const parsed = Number(value ?? 0)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw Object.assign(new Error('Dashboard metric is outside the supported numeric range.'), {
      statusCode: 500,
    })
  }
  return parsed
}

function metric(key, label, value) {
  return { key, label, value: count(value) }
}

function chart(key, title, rows) {
  return {
    key,
    title,
    items: rows.map((row) => ({
      label: String(row.label),
      value: count(row.value),
    })),
  }
}

async function adminAnalytics() {
  const [[summaryRows], [requirementRows], [applicationRows]] = await Promise.all([
    pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM customers) AS customers,
         (SELECT COUNT(*) FROM users WHERE role = 'RECRUITER' AND status = 'ACTIVE') AS activeRecruiters,
         (SELECT COUNT(*) FROM job_profiles WHERE status = 'ACTIVE') AS activeJobProfiles,
         (SELECT COUNT(*) FROM job_requirements WHERE status = 'OPEN') AS openRequirements,
         (SELECT COUNT(*) FROM candidates WHERE status IN ('NEW','ACTIVE')) AS availableCandidates,
         (SELECT COUNT(*) FROM placements WHERE outcome IN ('JOINED','CONFIRMED')) AS placements`,
    ),
    pool.execute(
      `SELECT status AS label, COUNT(*) AS value
       FROM job_requirements
       GROUP BY status
       ORDER BY status`,
    ),
    pool.execute(
      `SELECT status AS label, COUNT(*) AS value
       FROM applications
       GROUP BY status
       ORDER BY status`,
    ),
  ])
  const summary = summaryRows[0] ?? {}

  return {
    metrics: [
      metric('customers', 'Customer companies', summary.customers),
      metric('activeRecruiters', 'Active recruiters', summary.activeRecruiters),
      metric('activeJobProfiles', 'Active job profiles', summary.activeJobProfiles),
      metric('openRequirements', 'Open requirements', summary.openRequirements),
      metric('availableCandidates', 'New / active candidates', summary.availableCandidates),
      metric('placements', 'Joined / confirmed placements', summary.placements),
    ],
    charts: [
      chart('requirements', 'Requirements by status', requirementRows),
      chart('applications', 'Candidate pipeline', applicationRows),
    ],
  }
}

async function customerAnalytics(userId) {
  const [contacts] = await pool.execute(
    `SELECT cc.customer_id
     FROM customer_contacts cc
     INNER JOIN users u ON u.user_id = cc.user_id
     WHERE cc.user_id = ? AND cc.status = 'ACTIVE'
       AND u.role = 'CUSTOMER' AND u.status = 'ACTIVE'
     ORDER BY cc.is_primary DESC, cc.contact_id
     LIMIT 1`,
    [userId],
  )
  if (!contacts[0]) {
    throw Object.assign(new Error('No active customer organisation is linked to this account.'), {
      statusCode: 403,
    })
  }
  const customerId = Number(contacts[0].customer_id)

  const [[summaryRows], [requirementRows], [applicationRows]] = await Promise.all([
    pool.execute(
      `SELECT
         COUNT(DISTINCT r.requirement_id) + COUNT(DISTINCT submitted.intake_id) AS totalRequirements,
         COUNT(DISTINCT CASE
           WHEN r.status IN ('PENDING_APPROVAL','APPROVED','OPEN','ON_HOLD')
           THEN r.requirement_id END) + COUNT(DISTINCT submitted.intake_id) AS activeRequirements,
         COUNT(DISTINCT submitted.intake_id) AS submittedRequests,
         COUNT(DISTINCT CASE
           WHEN shared_contact.contact_id IS NOT NULL
             AND shared_user.user_id IS NOT NULL
           THEN ap.application_id END) AS submittedCandidates,
         COUNT(DISTINCT CASE
           WHEN shared_contact.contact_id IS NOT NULL
             AND shared_user.user_id IS NOT NULL
             AND i.status = 'SCHEDULED'
             AND i.scheduled_start >= CURRENT_TIMESTAMP
           THEN i.interview_id END) AS upcomingInterviews
       FROM customers customer
       LEFT JOIN agreements a ON a.customer_id = customer.customer_id
       LEFT JOIN service_orders so ON so.agreement_id = a.agreement_id
       LEFT JOIN job_requirements r ON r.service_order_id = so.service_order_id
       LEFT JOIN customer_requirement_intakes submitted
         ON submitted.customer_id = customer.customer_id
         AND submitted.status = 'SUBMITTED'
       LEFT JOIN applications ap ON ap.requirement_id = r.requirement_id
       LEFT JOIN resume_shares rs
         ON rs.application_id = ap.application_id
         AND rs.status IN ('SHARED','VIEWED','EXPIRED')
       LEFT JOIN customer_contacts shared_contact
         ON shared_contact.contact_id = rs.shared_with_contact_id
         AND shared_contact.customer_id = customer.customer_id
         AND shared_contact.status = 'ACTIVE'
       LEFT JOIN users shared_user
         ON shared_user.user_id = shared_contact.user_id
         AND shared_user.role = 'CUSTOMER'
         AND shared_user.status = 'ACTIVE'
       LEFT JOIN interviews i ON i.application_id = ap.application_id
       WHERE customer.customer_id = ?
       GROUP BY customer.customer_id`,
      [customerId],
    ),
    pool.execute(
      `SELECT requirement_status.label, requirement_status.value
       FROM (
         SELECT r.status AS label, COUNT(DISTINCT r.requirement_id) AS value
         FROM agreements a
         INNER JOIN service_orders so ON so.agreement_id = a.agreement_id
         INNER JOIN job_requirements r ON r.service_order_id = so.service_order_id
         WHERE a.customer_id = ?
         GROUP BY r.status
         UNION ALL
         SELECT 'SUBMITTED' AS label, COUNT(*) AS value
         FROM customer_requirement_intakes
         WHERE customer_id = ? AND status = 'SUBMITTED'
         HAVING COUNT(*) > 0
       ) requirement_status
       ORDER BY requirement_status.label`,
      [customerId, customerId],
    ),
    pool.execute(
      `SELECT ap.status AS label, COUNT(DISTINCT ap.application_id) AS value
       FROM agreements a
       INNER JOIN service_orders so ON so.agreement_id = a.agreement_id
       INNER JOIN job_requirements r ON r.service_order_id = so.service_order_id
       INNER JOIN applications ap ON ap.requirement_id = r.requirement_id
       WHERE a.customer_id = ?
         AND EXISTS (
           SELECT 1
           FROM resume_shares rs
           INNER JOIN customer_contacts shared_contact
             ON shared_contact.contact_id = rs.shared_with_contact_id
           INNER JOIN users shared_user ON shared_user.user_id = shared_contact.user_id
           WHERE rs.application_id = ap.application_id
             AND shared_contact.customer_id = a.customer_id
             AND shared_contact.status = 'ACTIVE'
             AND shared_user.role = 'CUSTOMER'
             AND shared_user.status = 'ACTIVE'
             AND rs.status IN ('SHARED','VIEWED','EXPIRED')
         )
       GROUP BY ap.status
       ORDER BY ap.status`,
      [customerId],
    ),
  ])
  const summary = summaryRows[0] ?? {}

  return {
    metrics: [
      metric('totalRequirements', 'All requirements', summary.totalRequirements),
      metric('activeRequirements', 'Active requirements', summary.activeRequirements),
      metric('submittedRequests', 'Requests awaiting review', summary.submittedRequests),
      metric('submittedCandidates', 'Candidates shared with your company', summary.submittedCandidates),
      metric('upcomingInterviews', 'Upcoming interviews', summary.upcomingInterviews),
    ],
    charts: [
      chart('requirements', 'Your requirements by status', requirementRows),
      chart('applications', 'Candidates shared with your company', applicationRows),
    ],
  }
}

async function recruiterAnalytics(userId) {
  const [[summaryRows], [requirementRows], [applicationRows]] = await Promise.all([
    pool.execute(
      `SELECT
         COUNT(DISTINCT CASE
           WHEN r.status IN ('APPROVED','OPEN','ON_HOLD')
           THEN r.requirement_id END) AS activeRequirements,
         COUNT(DISTINCT ap.application_id) AS candidatesInPipeline,
         COUNT(DISTINCT CASE
           WHEN i.status = 'SCHEDULED' AND i.scheduled_start >= CURRENT_TIMESTAMP
           THEN i.interview_id END) AS upcomingInterviews,
         COUNT(DISTINCT CASE
           WHEN p.outcome IN ('JOINED','CONFIRMED')
           THEN p.placement_id END) AS placements
       FROM requirement_assignments ra
       INNER JOIN job_requirements r ON r.requirement_id = ra.requirement_id
       LEFT JOIN applications ap
         ON ap.requirement_id = r.requirement_id
         AND (ap.recruiter_id = ? OR ap.recruiter_id IS NULL)
       LEFT JOIN interviews i ON i.application_id = ap.application_id
       LEFT JOIN selections s ON s.application_id = ap.application_id
       LEFT JOIN placements p ON p.selection_id = s.selection_id
       WHERE ra.recruiter_id = ?`,
      [userId, userId],
    ),
    pool.execute(
      `SELECT r.status AS label, COUNT(DISTINCT r.requirement_id) AS value
       FROM requirement_assignments ra
       INNER JOIN job_requirements r ON r.requirement_id = ra.requirement_id
       WHERE ra.recruiter_id = ?
       GROUP BY r.status
       ORDER BY r.status`,
      [userId],
    ),
    pool.execute(
      `SELECT ap.status AS label, COUNT(DISTINCT ap.application_id) AS value
       FROM requirement_assignments ra
       INNER JOIN applications ap ON ap.requirement_id = ra.requirement_id
       WHERE ra.recruiter_id = ?
         AND (ap.recruiter_id = ? OR ap.recruiter_id IS NULL)
       GROUP BY ap.status
       ORDER BY ap.status`,
      [userId, userId],
    ),
  ])
  const summary = summaryRows[0] ?? {}

  return {
    metrics: [
      metric('activeRequirements', 'Assigned active requirements', summary.activeRequirements),
      metric('candidatesInPipeline', 'Candidates in your pipeline', summary.candidatesInPipeline),
      metric('upcomingInterviews', 'Upcoming interviews', summary.upcomingInterviews),
      metric('placements', 'Joined / confirmed placements', summary.placements),
    ],
    charts: [
      chart('requirements', 'Assigned requirements by status', requirementRows),
      chart('applications', 'Your candidate pipeline', applicationRows),
    ],
  }
}

async function candidateAnalytics(userId) {
  const candidate = await getCandidateProfileForUser(userId)
  if (!candidate) {
    throw Object.assign(new Error('This account is not an active candidate account.'), {
      statusCode: 409,
    })
  }

  const [[summaryRows], [applicationRows]] = await Promise.all([
    pool.execute(
      `SELECT
         COUNT(DISTINCT ap.application_id) AS applications,
         COUNT(DISTINCT CASE WHEN ap.status = 'INTERVIEW' THEN ap.application_id END) AS interviews,
         COUNT(DISTINCT CASE WHEN ap.status = 'SELECTED' THEN ap.application_id END) AS selections
       FROM applications ap
       WHERE ap.candidate_id = ?`,
      [candidate.candidate_id],
    ),
    pool.execute(
      `SELECT status AS label, COUNT(*) AS value
       FROM applications
       WHERE candidate_id = ?
       GROUP BY status
       ORDER BY status`,
      [candidate.candidate_id],
    ),
  ])
  const summary = summaryRows[0] ?? {}

  return {
    metrics: [
      metric('applications', 'My applications', summary.applications),
      metric('interviews', 'Interview-stage applications', summary.interviews),
      metric('selections', 'Selections', summary.selections),
    ],
    charts: [chart('applications', 'My application status', applicationRows)],
  }
}

export async function getDashboardAnalytics(user) {
  let data
  if (user.role === 'ADMIN') data = await adminAnalytics()
  else if (user.role === 'CUSTOMER') data = await customerAnalytics(user.user_id)
  else if (user.role === 'RECRUITER') data = await recruiterAnalytics(user.user_id)
  else if (user.role === 'CANDIDATE') data = await candidateAnalytics(user.user_id)
  else {
    throw Object.assign(new Error('This account role does not have a dashboard.'), { statusCode: 403 })
  }

  return {
    role: user.role,
    asOf: new Date().toISOString(),
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    ...data,
  }
}
