import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { pool } from '../config/db.js'
import { resolvePrivateStoragePath } from '../agreements/document-storage.js'
import { randomUUID } from 'node:crypto'

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

async function saveRecruiterConsent(executor, candidateId, requirementId, customerId, userId, consentMethod = 'OTHER') {
  const [existing] = await executor.execute(
    `SELECT candidate_consent_id
     FROM candidate_consents
     WHERE candidate_id = ? AND requirement_id = ? AND customer_id = ?
       AND withdrawn_at IS NULL
     LIMIT 1`,
    [candidateId, requirementId, customerId],
  )
  if (existing[0]) return existing[0].candidate_consent_id

  const [result] = await executor.execute(
    `INSERT INTO candidate_consents
      (candidate_id, requirement_id, customer_id, consent_text_version,
       consent_method, consented_at, recorded_by)
     VALUES (?, ?, ?, 'RECRUITER_CONFIRMATION_V1', ?, CURRENT_TIMESTAMP, ?)`,
    [candidateId, requirementId, customerId, consentMethod, userId],
  )
  return result.insertId
}

export async function getRecruiterRequirements(req, res, next) {
  try {
    const userId = req.authUser.user_id;
    const isAdmin = req.authUser.role === 'ADMIN';

    const sql = `
      SELECT
        r.requirement_id,
        r.requirement_number AS requirement_code,
        r.job_title,
        r.headcount AS open_positions,
        r.status,
        r.work_mode,
        r.work_location,
        r.experience_min_years,
        r.experience_max_years,
        r.job_description,
        r.employment_schedule,
        r.hours_per_week,
        r.salary_min,
        r.salary_max,
        r.target_join_date,
        r.created_at,
        CASE WHEN ? = 1 THEN 'ADMIN' ELSE (
          SELECT ra.assignment_role
          FROM requirement_assignments ra
          WHERE ra.requirement_id = r.requirement_id
            AND ra.recruiter_id = ?
            AND ra.unassigned_at IS NULL
          ORDER BY ra.assigned_at DESC
          LIMIT 1
        ) END AS assignment_role,

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
      isAdmin ? [1, userId] : [0, userId, userId],
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
    if (req.authUser.role === 'RECRUITER') {
      const [assigned] = await pool.execute(
        `SELECT 1
         FROM requirement_assignments
         WHERE requirement_id = ? AND recruiter_id = ? AND unassigned_at IS NULL
         LIMIT 1`,
        [requirementId, req.authUser.user_id],
      )
      if (!assigned[0]) return res.status(403).json({ message: 'This requirement is not assigned to you.' })
    }

    const [submissions] = await pool.execute(
      `SELECT
        a.application_id,
        a.requirement_id,
        a.candidate_id,
        a.status AS application_status,
        a.applied_at AS submitted_at,
        CONCAT_WS(' ', c.first_name, c.last_name) AS candidate_name,
        c.email AS candidate_email,
        c.mobile AS candidate_phone,
        c.total_experience_years,
        CONCAT_WS(', ', c.current_city, c.current_state) AS current_location,
        (SELECT GROUP_CONCAT(s.skill_name ORDER BY s.skill_name SEPARATOR ', ')
         FROM candidate_skills cs
         INNER JOIN skills s ON s.skill_id = cs.skill_id
         WHERE cs.candidate_id = c.candidate_id) AS primary_skills,
        (SELECT cd.verification_status
         FROM candidate_documents cd
         WHERE cd.candidate_id = c.candidate_id
           AND cd.document_type = 'RESUME'
           AND cd.is_current = 1
         ORDER BY cd.uploaded_at DESC
         LIMIT 1) AS resume_verification_status,
        (SELECT cd.malware_scan_status
         FROM candidate_documents cd
         WHERE cd.candidate_id = c.candidate_id
           AND cd.document_type = 'RESUME'
           AND cd.is_current = 1
         ORDER BY cd.uploaded_at DESC
         LIMIT 1) AS resume_malware_scan_status,
        rs.share_id,
        rs.access_expires_at,
        rs.status AS share_status,
        CASE WHEN rs.status IN ('SHARED', 'VIEWED')
          AND rs.access_expires_at > CURRENT_TIMESTAMP THEN 1 ELSE 0 END AS share_is_valid
       FROM applications a
       JOIN candidates c ON c.candidate_id = a.candidate_id
       LEFT JOIN resume_shares rs
         ON rs.share_id = (
           SELECT MAX(rs2.share_id)
           FROM resume_shares rs2
           WHERE rs2.application_id = a.application_id
         )
       WHERE a.requirement_id = ?
       ORDER BY a.applied_at DESC`,
      [requirementId],
    )

    return res.json({ submissions })
  } catch (error) {
    return next(error)
  }
}

function applicationScope(req) {
  if (req.authUser.role === 'ADMIN') return { sql: '1 = 1', values: [] }
  return {
    sql: `(a.recruiter_id = ? OR EXISTS (
      SELECT 1
      FROM requirement_assignments ra
      WHERE ra.requirement_id = a.requirement_id
        AND ra.recruiter_id = ?
        AND ra.unassigned_at IS NULL
    ))`,
    values: [req.authUser.user_id, req.authUser.user_id],
  }
}

export async function getRecruiterApplications(req, res, next) {
  try {
    const scope = applicationScope(req)
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const searchSql = search
      ? `AND (a.application_number LIKE ? OR CONCAT_WS(' ', candidate.first_name, candidate.last_name) LIKE ?
          OR r.job_title LIKE ? OR customer.company_name LIKE ?)`
      : ''
    const values = [...scope.values]
    if (search) values.push(...Array(4).fill(`%${search}%`))

    const [applications] = await pool.execute(
      `SELECT a.application_id, a.application_number, a.status, a.applied_at,
              a.requirement_id, a.candidate_id,
              CONCAT_WS(' ', candidate.first_name, candidate.last_name) AS candidate_name,
              candidate.email AS candidate_email,
              candidate.mobile AS candidate_mobile,
              r.requirement_number, r.job_title,
              customer.company_name,
              recruiter.full_name AS recruiter_name
       FROM applications a
       INNER JOIN candidates candidate ON candidate.candidate_id = a.candidate_id
       INNER JOIN job_requirements r ON r.requirement_id = a.requirement_id
       INNER JOIN service_orders so ON so.service_order_id = r.service_order_id
       INNER JOIN agreements agreement ON agreement.agreement_id = so.agreement_id
       INNER JOIN customers customer ON customer.customer_id = agreement.customer_id
       LEFT JOIN users recruiter ON recruiter.user_id = a.recruiter_id
       WHERE ${scope.sql} ${searchSql}
       ORDER BY a.applied_at DESC, a.application_id DESC
       LIMIT 250`,
      values,
    )
    return res.json({ applications })
  } catch (error) {
    return next(error)
  }
}

export async function updateRecruiterApplicationStatus(req, res, next) {
  const connection = await pool.getConnection()
  try {
    const applicationId = Number(req.params.applicationId)
    const nextStatus = req.body?.status
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : ''
    const transitions = {
      APPLIED: ['SCREENING', 'REJECTED'],
      SCREENING: ['SHORTLISTED', 'REJECTED'],
      SHORTLISTED: ['INTERVIEW', 'REJECTED'],
      INTERVIEW: ['SELECTED', 'REJECTED'],
      SELECTED: [],
      REJECTED: [],
      WITHDRAWN: [],
    }

    if (!Number.isSafeInteger(applicationId) || applicationId < 1) {
      throw httpError(400, 'Invalid application ID.')
    }
    if (!Object.values(transitions).flat().includes(nextStatus)) {
      throw httpError(400, 'Select a valid next application status.')
    }
    if (reason.length > 500) throw httpError(400, 'Status reason must be 500 characters or fewer.')

    await connection.beginTransaction()
    const scope = applicationScope(req)
    const [applications] = await connection.execute(
      `SELECT a.status
       FROM applications a
       WHERE a.application_id = ? AND ${scope.sql}
       FOR UPDATE`,
      [applicationId, ...scope.values],
    )
    if (!applications[0]) throw httpError(404, 'Application not found or not assigned to you.')

    const currentStatus = applications[0].status
    if (!transitions[currentStatus]?.includes(nextStatus)) {
      throw httpError(409, `An application cannot move from ${currentStatus} to ${nextStatus}.`)
    }

    await connection.execute(
      'UPDATE applications SET status = ? WHERE application_id = ?',
      [nextStatus, applicationId],
    )
    await connection.execute(
      `INSERT INTO application_status_history
        (application_id, old_status, new_status, changed_by, change_reason)
       VALUES (?, ?, ?, ?, ?)`,
      [applicationId, currentStatus, nextStatus, req.authUser.user_id, reason || null],
    )
    await connection.commit()
    return res.json({ message: 'Application status updated.', status: nextStatus })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
}

export async function getRecruiterInterviews(req, res, next) {
  try {
    const scope = applicationScope(req)
    const [interviews] = await pool.execute(
      `SELECT i.interview_id, i.application_id, i.round_number, i.interview_type,
              i.scheduled_start, i.scheduled_end, i.location_or_link, i.status,
              a.application_number, a.status AS application_status,
              CONCAT_WS(' ', candidate.first_name, candidate.last_name) AS candidate_name,
              r.requirement_number, r.job_title, customer.company_name,
              interviewer.full_name AS interviewer_name
       FROM interviews i
       INNER JOIN applications a ON a.application_id = i.application_id
       INNER JOIN candidates candidate ON candidate.candidate_id = a.candidate_id
       INNER JOIN job_requirements r ON r.requirement_id = a.requirement_id
       INNER JOIN service_orders so ON so.service_order_id = r.service_order_id
       INNER JOIN agreements agreement ON agreement.agreement_id = so.agreement_id
       INNER JOIN customers customer ON customer.customer_id = agreement.customer_id
       LEFT JOIN users interviewer ON interviewer.user_id = i.interviewer_user_id
       WHERE ${scope.sql}
       ORDER BY i.scheduled_start DESC, i.interview_id DESC
       LIMIT 250`,
      scope.values,
    )
    return res.json({ interviews })
  } catch (error) {
    return next(error)
  }
}

export async function scheduleRecruiterInterview(req, res, next) {
  const connection = await pool.getConnection()
  try {
    const applicationId = Number(req.body?.applicationId)
    const interviewType = req.body?.interviewType
    const scheduledStart = req.body?.scheduledStart
    const scheduledEnd = req.body?.scheduledEnd
    const locationOrLink = typeof req.body?.locationOrLink === 'string'
      ? req.body.locationOrLink.trim()
      : ''
    const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

    if (!Number.isInteger(applicationId) || applicationId < 1) {
      throw httpError(400, 'Select a valid application.')
    }
    if (!['PHONE', 'VIDEO', 'IN_PERSON'].includes(interviewType)) {
      throw httpError(400, 'Select a valid interview type.')
    }
    if (typeof scheduledStart !== 'string' || typeof scheduledEnd !== 'string'
      || !dateTimePattern.test(scheduledStart) || !dateTimePattern.test(scheduledEnd)
      || Number.isNaN(new Date(scheduledStart).getTime())
      || Number.isNaN(new Date(scheduledEnd).getTime())
      || new Date(scheduledEnd).getTime() <= new Date(scheduledStart).getTime()) {
      throw httpError(400, 'Enter a valid start and end time; the end must be later than the start.')
    }
    if (locationOrLink.length > 500) throw httpError(400, 'Location or meeting link must be 500 characters or fewer.')

    const scope = applicationScope(req)
    await connection.beginTransaction()
    const [applications] = await connection.execute(
      `SELECT a.application_id, a.status
       FROM applications a
       WHERE a.application_id = ? AND ${scope.sql}
       LIMIT 1
       FOR UPDATE`,
      [applicationId, ...scope.values],
    )
    if (!applications[0]) throw httpError(404, 'Application not found or not assigned to you.')
    if (['SELECTED', 'REJECTED', 'WITHDRAWN'].includes(applications[0].status)) {
      throw httpError(409, 'An interview cannot be scheduled for a selected, rejected or withdrawn application.')
    }

    const [rounds] = await connection.execute(
      'SELECT COALESCE(MAX(round_number), 0) + 1 AS next_round FROM interviews WHERE application_id = ?',
      [applicationId],
    )
    const [result] = await connection.execute(
      `INSERT INTO interviews
        (application_id, round_number, interview_type, scheduled_start, scheduled_end,
         location_or_link, interviewer_user_id, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?)`,
      [
        applicationId,
        rounds[0].next_round,
        interviewType,
        `${scheduledStart.replace('T', ' ')}:00`,
        `${scheduledEnd.replace('T', ' ')}:00`,
        locationOrLink || null,
        req.authUser.user_id,
        req.authUser.user_id,
      ],
    )
    await connection.commit()
    return res.status(201).json({ interviewId: result.insertId, message: 'Interview scheduled.' })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
}

export async function searchCandidates(req, res, next) {
  try {
    const requirementId = Number(req.query.requirementId)
    if (!Number.isSafeInteger(requirementId) || requirementId < 1) {
      throw httpError(400, 'Select an assigned requirement before searching candidates.')
    }
    if (req.authUser.role === 'RECRUITER') {
      const [assigned] = await pool.execute(
        `SELECT 1 FROM requirement_assignments
         WHERE requirement_id = ? AND recruiter_id = ? AND unassigned_at IS NULL
         LIMIT 1`,
        [requirementId, req.authUser.user_id],
      )
      if (!assigned[0]) throw httpError(403, 'This requirement is not assigned to you.')
    }
    const [requirementRows] = await pool.execute(
      'SELECT job_profile_id, experience_min_years, experience_max_years FROM job_requirements WHERE requirement_id = ?',
      [requirementId],
    )
    if (!requirementRows[0]) throw httpError(404, 'Requirement not found.')
    const requirement = requirementRows[0]
    let [requiredSkills] = await pool.execute(
      `SELECT s.skill_id, s.skill_name, rs.is_mandatory
       FROM job_requirement_skills rs
       JOIN skills s ON s.skill_id = rs.skill_id
       WHERE rs.requirement_id = ?
       ORDER BY rs.is_mandatory DESC, s.skill_name`,
      [requirementId],
    )
    if (requiredSkills.length === 0) {
      ;[requiredSkills] = await pool.execute(
        `SELECT s.skill_id, s.skill_name, ps.is_mandatory
         FROM job_profile_skills ps
         JOIN skills s ON s.skill_id = ps.skill_id
         WHERE ps.job_profile_id = ?
         ORDER BY ps.is_mandatory DESC, s.skill_name`,
        [requirement.job_profile_id],
      )
    }

    const skill = typeof req.query.skill === 'string' ? req.query.skill.trim() : ''
    const location = typeof req.query.location === 'string' ? req.query.location.trim() : ''
    const query = typeof req.query.query === 'string' ? req.query.query.trim() : ''
    const experienceMin = req.query.experienceMin
    const experienceMax = req.query.experienceMax
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

    if (experienceMin !== undefined && experienceMin !== ''
      && experienceMax !== undefined && experienceMax !== ''
      && Number(experienceMin) > Number(experienceMax)) {
      return res.status(400).json({ message: 'Maximum experience must be greater than or equal to minimum experience.' })
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
          c.total_experience_years,
          CONCAT_WS(', ', c.current_city, c.current_state) AS current_location,
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
          ) AS primary_skills,

          (
            SELECT cd.verification_status
            FROM candidate_documents cd
            WHERE cd.candidate_id = c.candidate_id
              AND cd.document_type = 'RESUME'
              AND cd.is_current = 1
            ORDER BY cd.uploaded_at DESC
            LIMIT 1
          ) AS resume_verification_status,

          (
            SELECT cd.malware_scan_status
            FROM candidate_documents cd
            WHERE cd.candidate_id = c.candidate_id
              AND cd.document_type = 'RESUME'
              AND cd.is_current = 1
            ORDER BY cd.uploaded_at DESC
            LIMIT 1
          ) AS resume_malware_scan_status

        FROM candidates c
        ${whereClause}
        ${whereClause ? 'AND' : 'WHERE'} c.status IN ('NEW', 'ACTIVE')
        ORDER BY c.created_at DESC
        LIMIT 50
      `,
      params,
    );

    const candidateSkillsById = new Map()
    if (candidates.length > 0) {
      const candidateIds = candidates.map((candidate) => candidate.candidate_id)
      const placeholders = candidateIds.map(() => '?').join(', ')
      const [candidateSkills] = await pool.execute(
        `SELECT cs.candidate_id, cs.skill_id, s.skill_name
         FROM candidate_skills cs
         JOIN skills s ON s.skill_id = cs.skill_id
         WHERE cs.candidate_id IN (${placeholders})`,
        candidateIds,
      )
      for (const row of candidateSkills) {
        const skills = candidateSkillsById.get(Number(row.candidate_id)) || []
        skills.push({ skill_id: Number(row.skill_id), skill_name: row.skill_name })
        candidateSkillsById.set(Number(row.candidate_id), skills)
      }
    }
    const requiredIds = new Set(requiredSkills.map((row) => Number(row.skill_id)))
    for (const candidate of candidates) {
      const candidateSkills = candidateSkillsById.get(Number(candidate.candidate_id)) || []
      const candidateSkillIds = new Set(candidateSkills.map((row) => row.skill_id))
      const matched = candidateSkills.filter((row) => requiredIds.has(row.skill_id))
      candidate.matched_skills = matched.map((row) => row.skill_name)
      candidate.missing_mandatory_skills = requiredSkills
        .filter((row) => Number(row.is_mandatory) === 1 && !candidateSkillIds.has(Number(row.skill_id)))
        .map((row) => row.skill_name)
      candidate.required_skill_count = requiredSkills.length
      candidate.matched_skill_count = matched.length
      candidate.match_score = requiredSkills.length
        ? Math.round((matched.length / requiredSkills.length) * 100)
        : null
      candidate.meets_experience = (
        (requirement.experience_min_years === null
          || Number(candidate.total_experience_years) >= Number(requirement.experience_min_years))
        && (requirement.experience_max_years === null
          || Number(candidate.total_experience_years) <= Number(requirement.experience_max_years))
      )
    }

    return res.json({ candidates });
  } catch (error) {
    return next(error);
  }
}

export async function getRecruiterCandidateDetails(req, res, next) {
  try {
    const candidateId = Number(req.params.candidateId)
    const requirementId = req.query.requirementId === undefined ? null : Number(req.query.requirementId)
    if (!Number.isSafeInteger(candidateId) || candidateId < 1) throw httpError(400, 'Invalid candidate ID.')
    if (req.query.requirementId !== undefined
      && (!Number.isSafeInteger(requirementId) || requirementId < 1)) {
      throw httpError(400, 'Invalid requirement ID.')
    }
    if (req.authUser.role === 'RECRUITER' && !requirementId) {
      throw httpError(400, 'Requirement context is required to view a candidate.')
    }
    if (requirementId && req.authUser.role === 'RECRUITER') {
      const [assigned] = await pool.execute(
        `SELECT 1 FROM requirement_assignments
         WHERE requirement_id = ? AND recruiter_id = ? AND unassigned_at IS NULL
         LIMIT 1`,
        [requirementId, req.authUser.user_id],
      )
      if (!assigned[0]) throw httpError(403, 'This requirement is not assigned to you.')
    }

    const [candidateRows] = await pool.execute(
      `SELECT candidate_id, candidate_code, first_name, last_name, email, mobile,
              current_city, current_state, total_experience_years, current_ctc,
              expected_ctc, notice_period_days, profile_summary, status
       FROM candidates
       WHERE candidate_id = ? AND status IN ('NEW', 'ACTIVE')
       LIMIT 1`,
      [candidateId],
    )
    if (!candidateRows[0]) throw httpError(404, 'Eligible candidate not found.')

    const [[education], [experience], [skills], [documents]] = await Promise.all([
      pool.execute(
        `SELECT education_id, qualification, specialization, institution,
                passing_year, grade_or_percentage
         FROM candidate_education WHERE candidate_id = ?
         ORDER BY passing_year DESC, education_id DESC`,
        [candidateId],
      ),
      pool.execute(
        `SELECT experience_id, employer_name, designation, start_date, end_date, is_current
         FROM candidate_experience WHERE candidate_id = ?
         ORDER BY start_date DESC, experience_id DESC`,
        [candidateId],
      ),
      pool.execute(
        `SELECT cs.skill_id, s.skill_name, s.skill_category,
                cs.experience_years, cs.proficiency
         FROM candidate_skills cs
         JOIN skills s ON s.skill_id = cs.skill_id
         WHERE cs.candidate_id = ?
         ORDER BY s.skill_name`,
        [candidateId],
      ),
      pool.execute(
        `SELECT document_id, file_name, uploaded_at, file_size_bytes,
                verification_status, malware_scan_status
         FROM candidate_documents
         WHERE candidate_id = ? AND document_type = 'RESUME' AND is_current = 1
         ORDER BY uploaded_at DESC
         LIMIT 1`,
        [candidateId],
      ),
    ])
    let match = null
    if (requirementId) {
      const [requirementRows] = await pool.execute(
        'SELECT job_profile_id, experience_min_years, experience_max_years FROM job_requirements WHERE requirement_id = ?',
        [requirementId],
      )
      if (!requirementRows[0]) throw httpError(404, 'Requirement not found.')
      let [requiredSkills] = await pool.execute(
        `SELECT s.skill_id, s.skill_name, rs.is_mandatory
         FROM job_requirement_skills rs
         JOIN skills s ON s.skill_id = rs.skill_id
         WHERE rs.requirement_id = ?`,
        [requirementId],
      )
      if (requiredSkills.length === 0) {
        ;[requiredSkills] = await pool.execute(
          `SELECT s.skill_id, s.skill_name, ps.is_mandatory
           FROM job_profile_skills ps
           JOIN skills s ON s.skill_id = ps.skill_id
           WHERE ps.job_profile_id = ?`,
          [requirementRows[0].job_profile_id],
        )
      }
      const candidateSkillIds = new Set(skills.map((row) => Number(row.skill_id)))
      const matchedSkills = requiredSkills
        .filter((row) => candidateSkillIds.has(Number(row.skill_id)))
        .map((row) => row.skill_name)
      const missingMandatorySkills = requiredSkills
        .filter((row) => Number(row.is_mandatory) === 1 && !candidateSkillIds.has(Number(row.skill_id)))
        .map((row) => row.skill_name)
      const totalExperience = Number(candidateRows[0].total_experience_years || 0)
      const requirement = requirementRows[0]
      match = {
        requiredSkillCount: requiredSkills.length,
        matchedSkillCount: matchedSkills.length,
        matchedSkills,
        missingMandatorySkills,
        score: requiredSkills.length
          ? Math.round((matchedSkills.length / requiredSkills.length) * 100)
          : null,
        meetsExperience: (
          (requirement.experience_min_years === null
            || totalExperience >= Number(requirement.experience_min_years))
          && (requirement.experience_max_years === null
            || totalExperience <= Number(requirement.experience_max_years))
        ),
      }
    }

    const document = documents[0] || null
    return res.json({
      candidate: candidateRows[0],
      education,
      experience,
      skills,
      match,
      resume: document ? {
        ...document,
        available: document.verification_status === 'VERIFIED'
          && document.malware_scan_status === 'CLEAN',
        download_url: `/api/recruiter/candidates/${candidateId}/resume?requirementId=${requirementId || ''}`,
      } : null,
    })
  } catch (error) {
    return next(error)
  }
}

export async function streamRecruiterCandidateResume(req, res, next) {
  try {
    const candidateId = Number(req.params.candidateId)
    const requirementId = Number(req.query.requirementId)
    if (!Number.isSafeInteger(candidateId) || candidateId < 1
      || !Number.isSafeInteger(requirementId) || requirementId < 1) {
      throw httpError(400, 'Candidate and requirement IDs are required.')
    }
    if (req.authUser.role === 'RECRUITER') {
      const [assigned] = await pool.execute(
        `SELECT 1 FROM requirement_assignments
         WHERE requirement_id = ? AND recruiter_id = ? AND unassigned_at IS NULL
         LIMIT 1`,
        [requirementId, req.authUser.user_id],
      )
      if (!assigned[0]) throw httpError(403, 'This requirement is not assigned to you.')
    }
    const [documents] = await pool.execute(
      `SELECT cd.file_path, cd.file_name
       FROM candidate_documents cd
       JOIN candidates c ON c.candidate_id = cd.candidate_id
       WHERE cd.candidate_id = ? AND cd.document_type = 'RESUME'
         AND cd.is_current = 1 AND c.status IN ('NEW', 'ACTIVE')
         AND cd.verification_status = 'VERIFIED'
         AND cd.malware_scan_status = 'CLEAN'
       ORDER BY cd.uploaded_at DESC
       LIMIT 1`,
      [candidateId],
    )
    if (!documents[0]) {
      throw httpError(409, 'This resume is not available until it is verified and security-cleared.')
    }
    const fullPath = resolvePrivateStoragePath(documents[0].file_path)
    let fileStats
    try {
      fileStats = await stat(fullPath)
    } catch (error) {
      if (error.code === 'ENOENT') throw httpError(404, 'Resume file not found.')
      throw error
    }
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', fileStats.size)
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${String(documents[0].file_name).replace(/[^a-zA-Z0-9._-]/g, '_')}"`,
    )
    return createReadStream(fullPath).pipe(res)
  } catch (error) {
    return next(error)
  }
}

export async function recordCandidateConsent(req, res, next) {
  try {
    const { candidateId, requirementId, consentMethod } = req.body
    if (req.body?.consentConfirmed !== true) {
      return res.status(400).json({ message: 'Confirm the candidate has explicitly consented before recording consent.' })
    }
    const parsedCandidateId = Number(candidateId)
    const parsedRequirementId = Number(requirementId)
    if (!Number.isInteger(parsedCandidateId) || parsedCandidateId < 1
      || !Number.isInteger(parsedRequirementId) || parsedRequirementId < 1) {
      return res.status(400).json({ message: 'Candidate ID and Requirement ID are required.' })
    }
    const method = consentMethod ?? 'OTHER'
    if (!['CANDIDATE_PORTAL', 'WRITTEN_EVIDENCE', 'OTHER'].includes(method)) {
      return res.status(400).json({ message: 'Select a supported consent method.' })
    }
    if (req.authUser.role === 'RECRUITER') {
      const [assigned] = await pool.execute(
        `SELECT 1 FROM requirement_assignments
         WHERE requirement_id = ? AND recruiter_id = ? AND unassigned_at IS NULL
         LIMIT 1`,
        [parsedRequirementId, req.authUser.user_id],
      )
      if (!assigned[0]) return res.status(403).json({ message: 'This requirement is not assigned to you.' })
    }

    const [requirements] = await pool.execute(
      `SELECT a.customer_id
       FROM job_requirements r
       INNER JOIN service_orders so ON so.service_order_id = r.service_order_id
       INNER JOIN agreements a ON a.agreement_id = so.agreement_id
       WHERE r.requirement_id = ?`,
      [parsedRequirementId],
    )
    if (!requirements[0]) return res.status(404).json({ message: 'Requirement not found.' })

    const [candidates] = await pool.execute(
      `SELECT candidate_id FROM candidates
       WHERE candidate_id = ? AND status IN ('NEW', 'ACTIVE')`,
      [parsedCandidateId],
    )
    if (!candidates[0]) return res.status(404).json({ message: 'Eligible candidate not found.' })

    const consentId = await saveRecruiterConsent(
      pool,
      parsedCandidateId,
      parsedRequirementId,
      requirements[0].customer_id,
      req.authUser.user_id,
      method,
    )

    return res.status(201).json({
      consentId,
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

    const candidateId = Number(req.body?.candidateId)
    const requirementId = Number(req.body?.requirementId)
    if (!Number.isInteger(candidateId) || candidateId < 1
      || !Number.isInteger(requirementId) || requirementId < 1) {
      throw httpError(400, 'Candidate ID and Requirement ID are required.')
    }
    if (req.body?.consentConfirmed !== true) {
      throw httpError(400, 'Confirm the candidate has consented before submission.')
    }

    if (req.authUser.role === 'RECRUITER') {
      const [assigned] = await connection.execute(
        `SELECT 1 FROM requirement_assignments
         WHERE requirement_id = ? AND recruiter_id = ? AND unassigned_at IS NULL
         LIMIT 1`,
        [requirementId, req.authUser.user_id],
      )
      if (!assigned[0]) throw httpError(403, 'This requirement is not assigned to you.')
    }

    const [reqRows] = await connection.execute(
      `SELECT r.requirement_id, r.status, a.customer_id
       FROM job_requirements r
       INNER JOIN service_orders so ON so.service_order_id = r.service_order_id
       INNER JOIN agreements a ON a.agreement_id = so.agreement_id
       WHERE r.requirement_id = ?
       FOR UPDATE`,
      [requirementId],
    )
    if (reqRows.length === 0) throw httpError(404, 'Requirement not found.')
    if (reqRows[0].status !== 'OPEN') throw httpError(409, 'Only open requirements can receive candidate submissions.')

    const [candidates] = await connection.execute(
      `SELECT candidate_id FROM candidates
       WHERE candidate_id = ? AND status IN ('NEW', 'ACTIVE')
       FOR UPDATE`,
      [candidateId],
    )
    if (!candidates[0]) throw httpError(404, 'Eligible candidate not found.')

    const [existing] = await connection.execute(
      `SELECT application_id FROM applications WHERE candidate_id = ? AND requirement_id = ?`,
      [candidateId, requirementId],
    )
    if (existing.length > 0) throw httpError(409, 'Candidate has already been submitted for this requirement.')

    await saveRecruiterConsent(
      connection,
      candidateId,
      requirementId,
      reqRows[0].customer_id,
      req.authUser.user_id,
    )

    const applicationNumber = `APP-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`
    const [appResult] = await connection.execute(
      `INSERT INTO applications
        (application_number, requirement_id, candidate_id, recruiter_id, status, source)
       VALUES (?, ?, ?, ?, 'APPLIED', 'RECRUITER_ADDED')`,
      [applicationNumber, requirementId, candidateId, req.authUser.user_id],
    )

    const applicationId = appResult.insertId
    await connection.execute(
      `INSERT INTO application_status_history
        (application_id, old_status, new_status, changed_by, change_reason)
       VALUES (?, NULL, 'APPLIED', ?, 'Candidate submitted by recruiter.')`,
      [applicationId, req.authUser.user_id],
    )
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

    const applicationId = Number(req.body?.applicationId)
    if (!Number.isInteger(applicationId) || applicationId < 1) {
      throw httpError(400, 'Application ID is required.')
    }

    const [apps] = await connection.execute(
      `SELECT a.application_id, a.requirement_id, a.candidate_id,
              agreement.customer_id, a.recruiter_id
       FROM applications a
       JOIN job_requirements r ON r.requirement_id = a.requirement_id
       JOIN service_orders so ON so.service_order_id = r.service_order_id
       JOIN agreements agreement ON agreement.agreement_id = so.agreement_id
       WHERE a.application_id = ?
       FOR UPDATE`,
      [applicationId],
    )

    if (!apps[0]) throw httpError(404, 'Application not found.')
    const appData = apps[0]

    if (req.authUser.role === 'RECRUITER' && Number(appData.recruiter_id) !== Number(req.authUser.user_id)) {
      const [assigned] = await connection.execute(
        `SELECT 1 FROM requirement_assignments
         WHERE requirement_id = ? AND recruiter_id = ? AND unassigned_at IS NULL
         LIMIT 1`,
        [appData.requirement_id, req.authUser.user_id],
      )
      if (!assigned[0]) throw httpError(403, 'This application is not assigned to you.')
    }

    const [consents] = await connection.execute(
      `SELECT candidate_consent_id
       FROM candidate_consents
       WHERE candidate_id = ? AND requirement_id = ? AND customer_id = ?
         AND withdrawn_at IS NULL
       LIMIT 1`,
      [appData.candidate_id, appData.requirement_id, appData.customer_id],
    )
    if (!consents[0]) throw httpError(409, 'Active candidate consent is required before sharing a resume.')

    const [contacts] = await connection.execute(
      `SELECT cc.contact_id
       FROM customer_contacts cc
       INNER JOIN users u ON u.user_id = cc.user_id
       WHERE cc.customer_id = ? AND cc.status = 'ACTIVE'
         AND u.role = 'CUSTOMER' AND u.status = 'ACTIVE'
       ORDER BY cc.is_primary DESC, cc.contact_id
       LIMIT 1`,
      [appData.customer_id],
    )
    if (!contacts[0]) throw httpError(409, 'No active customer contact is available to receive the resume share.')

    const [documents] = await connection.execute(
      `SELECT document_id
       FROM candidate_documents
       WHERE candidate_id = ? AND document_type = 'RESUME' AND is_current = 1
         AND verification_status = 'VERIFIED' AND malware_scan_status = 'CLEAN'
       ORDER BY uploaded_at DESC
       LIMIT 1`,
      [appData.candidate_id],
    )
    if (!documents[0]) {
      throw httpError(409, 'A verified, security-cleared resume is required before sharing with a customer.')
    }

    const [shareResult] = await connection.execute(
      `INSERT INTO resume_shares
        (application_id, shared_with_contact_id, document_id, shared_by, access_expires_at, status)
       VALUES (?, ?, ?, ?, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 24 HOUR), 'SHARED')`,
      [applicationId, contacts[0].contact_id, documents[0].document_id, req.authUser.user_id],
    )

    const shareId = shareResult.insertId

    await connection.execute(
      `INSERT INTO resume_share_events (share_id, event_code, actor_user_id)
       VALUES (?, 'CREATED', ?)`,
      [shareId, req.authUser.user_id],
    )

    await connection.commit()

    return res.status(201).json({
      shareId,
      message: 'A 24-hour resume share was created for the customer.',
    })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
}
