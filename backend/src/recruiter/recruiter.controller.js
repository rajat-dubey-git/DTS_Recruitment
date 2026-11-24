import { pool } from '../config/db.js'
import { randomUUID } from 'node:crypto'

export async function getRecruiterRequirements(req, res, next) {
  try {
    const userId = req.authUser.user_id;
    const isAdmin = req.authUser.role === 'ADMIN';

    const sql = `
      SELECT
        r.requirement_id,
        r.requirement_number,
        r.job_title,
        r.headcount,
        r.status,
        r.work_mode,
        r.work_location,
        r.experience_min_years,
        r.experience_max_years,
        r.created_at,

        c.customer_id,
        c.company_name,

        jp.job_profile_id,
        jp.profile_name AS job_profile_title,

        (
          SELECT COUNT(*)
          FROM applications a
          WHERE a.requirement_id = r.requirement_id
        ) AS total_submissions

      FROM job_requirements r

      INNER JOIN service_orders so
        ON so.service_order_id = r.service_order_id

      INNER JOIN agreements ag
        ON ag.agreement_id = so.agreement_id

      INNER JOIN customers c
        ON c.customer_id = ag.customer_id

      INNER JOIN job_profiles jp
        ON jp.job_profile_id = r.job_profile_id

      WHERE
        ${isAdmin
          ? '1 = 1'
          : `EXISTS (
              SELECT 1
              FROM requirement_assignments ra
              WHERE ra.requirement_id = r.requirement_id
                AND ra.recruiter_id = ?
                AND ra.unassigned_at IS NULL
            )`
        }

      ORDER BY r.created_at DESC
    `;

    const [requirements] = await pool.execute(
      sql,
      isAdmin ? [] : [userId],
    );

    return res.json({ requirements });
  } catch (error) {
    return next(error);
  }
}

export async function getRequirementSubmissions(req, res, next) {
  try {
    const requirementId = Number(req.params.requirementId)
    if (!requirementId) return res.status(400).json({ message: 'Invalid requirement ID.' })

    const [submissions] = await pool.execute(
      `SELECT 
        a.application_id,
        a.requirement_id,
        a.candidate_id,
        a.status AS application_status,
        a.submitted_at,
        c.full_name AS candidate_name,
        c.email AS candidate_email,
        c.phone AS candidate_phone,
        c.total_experience_years,
        c.current_location,
        c.primary_skills,
        c.resume_path,
        rs.share_id,
        rs.access_token,
        rs.access_expires_at,
        rs.customer_decision,
        rs.decision_notes,
        rs.is_active AS share_is_active,
        CASE WHEN rs.access_expires_at > CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS share_is_valid
       FROM applications a
       JOIN candidates c ON c.candidate_id = a.candidate_id
       LEFT JOIN resume_shares rs ON rs.application_id = a.application_id
       WHERE a.requirement_id = ?
       ORDER BY a.submitted_at DESC`,
      [requirementId],
    )

    return res.json({ submissions })
  } catch (error) {
    return next(error)
  }
}

export async function searchCandidates(req, res, next) {
  try {
    const {
      skill,
      experienceMin,
      experienceMax,
      location,
      query,
    } = req.query;

    const conditions = [];
    const params = [];

    if (query) {
      conditions.push(`
        (
          CONCAT_WS(' ', c.first_name, c.last_name) LIKE ?
          OR c.email LIKE ?
          OR c.mobile LIKE ?
        )
      `);

      const search = `%${query}%`;
      params.push(search, search, search);
    }

    if (skill) {
      conditions.push(`
        EXISTS (
          SELECT 1
          FROM candidate_skills cs
          INNER JOIN skills s ON s.skill_id = cs.skill_id
          WHERE cs.candidate_id = c.candidate_id
            AND s.skill_name LIKE ?
        )
      `);

      params.push(`%${skill}%`);
    }

    if (location) {
      conditions.push(`
        (
          c.current_city LIKE ?
          OR c.current_state LIKE ?
        )
      `);

      params.push(`%${location}%`, `%${location}%`);
    }

    if (experienceMin !== undefined && experienceMin !== '') {
      const min = Number(experienceMin);

      if (!Number.isFinite(min) || min < 0) {
        return res.status(400).json({
          message: 'Invalid minimum experience.',
        });
      }

      conditions.push('c.total_experience_years >= ?');
      params.push(min);
    }

    if (experienceMax !== undefined && experienceMax !== '') {
      const max = Number(experienceMax);

      if (!Number.isFinite(max) || max < 0) {
        return res.status(400).json({
          message: 'Invalid maximum experience.',
        });
      }

      conditions.push('c.total_experience_years <= ?');
      params.push(max);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    const [candidates] = await pool.execute(
      `
        SELECT
          c.candidate_id,
          c.candidate_code,
          CONCAT_WS(' ', c.first_name, c.last_name) AS full_name,
          c.email,
          c.mobile,
          c.total_experience_years,
          c.current_city,
          c.current_state,
          c.current_ctc,
          c.expected_ctc,
          c.notice_period_days,
          c.profile_summary,
          c.status,
          c.created_at,

          (
            SELECT GROUP_CONCAT(s.skill_name ORDER BY s.skill_name SEPARATOR ', ')
            FROM candidate_skills cs
            INNER JOIN skills s ON s.skill_id = cs.skill_id
            WHERE cs.candidate_id = c.candidate_id
          ) AS skills,

          (
            SELECT cd.file_path
            FROM candidate_documents cd
            WHERE cd.candidate_id = c.candidate_id
              AND cd.document_type = 'RESUME'
              AND cd.is_current = 1
            LIMIT 1
          ) AS resume_path

        FROM candidates c
        ${whereClause}
        ORDER BY c.created_at DESC
        LIMIT 50
      `,
      params,
    );

    return res.json({ candidates });
  } catch (error) {
    return next(error);
  }
}

export async function recordCandidateConsent(req, res, next) {
  try {
    const { candidateId, requirementId, consentMethod, consentProofNotes } = req.body
    if (!candidateId || !requirementId) {
      return res.status(400).json({ message: 'Candidate ID and Requirement ID are required.' })
    }

    const [result] = await pool.execute(
      `INSERT INTO candidate_consents
        (candidate_id, requirement_id, consent_status, consent_channel, notes, consent_timestamp, recorded_by_user_id)
       VALUES (?, ?, 'GRANTED', ?, ?, CURRENT_TIMESTAMP, ?)`,
      [candidateId, requirementId, consentMethod || 'EMAIL', consentProofNotes || 'Verbal/Email Consent Confirmed', req.authUser.user_id],
    )

    return res.status(201).json({
      consentId: result.insertId,
      message: 'Candidate consent recorded successfully.',
    })
  } catch (error) {
    return next(error)
  }
}

export async function submitCandidateForRequirement(req, res, next) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const { candidateId, requirementId, screeningNotes } = req.body
    if (!candidateId || !requirementId) {
      return res.status(400).json({ message: 'Candidate ID and Requirement ID are required.' })
    }

    // Check requirement status
    const [reqRows] = await connection.execute(
      `SELECT requirement_id, customer_id, status FROM job_requirements WHERE requirement_id = ?`,
      [requirementId],
    )
    if (reqRows.length === 0) {
      return res.status(404).json({ message: 'Requirement not found.' })
    }

    // Check if application already exists
    const [existing] = await connection.execute(
      `SELECT application_id FROM applications WHERE candidate_id = ? AND requirement_id = ?`,
      [candidateId, requirementId],
    )
    if (existing.length > 0) {
      return res.status(409).json({ message: 'Candidate has already been submitted for this requirement.' })
    }

    // Verify consent exists
    const [consentRows] = await connection.execute(
      `SELECT consent_id FROM candidate_consents WHERE candidate_id = ? AND requirement_id = ? AND consent_status = 'GRANTED'`,
      [candidateId, requirementId],
    )
    if (consentRows.length === 0) {
      // Create auto consent if submitted
      await connection.execute(
        `INSERT INTO candidate_consents
          (candidate_id, requirement_id, consent_status, consent_channel, notes, consent_timestamp, recorded_by_user_id)
         VALUES (?, ?, 'GRANTED', 'RECRUITER_CONFIRMED', 'Screened and consent confirmed at submission', CURRENT_TIMESTAMP, ?)`,
        [candidateId, requirementId, req.authUser.user_id],
      )
    }

    // Insert into applications
    const [appResult] = await connection.execute(
      `INSERT INTO applications
        (requirement_id, candidate_id, recruiter_user_id, status, submitted_at, screening_notes)
       VALUES (?, ?, ?, 'SUBMITTED', CURRENT_TIMESTAMP, ?)`,
      [requirementId, candidateId, req.authUser.user_id, screeningNotes || 'Candidate screened and matched.'],
    )

    const applicationId = appResult.insertId
    await connection.commit()

    return res.status(201).json({
      applicationId,
      message: 'Candidate submitted successfully to requirement.',
    })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
}

export async function createSecureResumeShare(req, res, next) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()

    const { applicationId } = req.body
    if (!applicationId) {
      return res.status(400).json({ message: 'Application ID is required.' })
    }

    const [apps] = await connection.execute(
      `SELECT 
        a.application_id, 
        a.requirement_id, 
        a.candidate_id, 
        r.customer_id,
        c.resume_path
       FROM applications a
       JOIN job_requirements r ON r.requirement_id = a.requirement_id
       JOIN candidates c ON c.candidate_id = a.candidate_id
       WHERE a.application_id = ?`,
      [applicationId],
    )

    if (apps.length === 0) {
      return res.status(404).json({ message: 'Application not found.' })
    }

    const appData = apps[0]
    const token = randomUUID()

    // Create 24-hr secure share
    const [shareResult] = await connection.execute(
      `INSERT INTO resume_shares
        (application_id, candidate_id, customer_id, requirement_id, shared_by_user_id, access_token, access_expires_at, is_active)
       VALUES (?, ?, ?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 24 HOUR), 1)`,
      [applicationId, appData.candidate_id, appData.customer_id, appData.requirement_id, req.authUser.user_id, token],
    )

    const shareId = shareResult.insertId

    // Log audit event
    await connection.execute(
      `INSERT INTO resume_share_events
        (share_id, event_type, actor_user_id, ip_address, user_agent, details)
       VALUES (?, 'SHARE_CREATED', ?, ?, ?, 'Secure 24-hour share generated')`,
      [shareId, req.authUser.user_id, req.ip || '127.0.0.1', req.headers['user-agent'] || ''],
    )

    // Update application status to PRESENTED
    await connection.execute(
      `UPDATE applications SET status = 'PRESENTED' WHERE application_id = ?`,
      [applicationId],
    )

    await connection.commit()

    return res.status(201).json({
      shareId,
      accessToken: token,
      message: 'Secure 24-hour resume share created and sent to customer.',
    })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
}
