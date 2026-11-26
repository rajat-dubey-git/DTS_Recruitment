import { createHash, randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pool } from '../config/db.js'
import { getCandidateProfileForUser } from './account-link.service.js'
import { notifyAssignedRecruiters } from '../notifications/notification.service.js'

async function getCandidateForUser(userId) {
  return getCandidateProfileForUser(userId)
}

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode })
}

export async function getMyDashboard(req, res, next) {
  try {
    const candidate = await getCandidateForUser(req.authUser.user_id)
    if (!candidate) throw httpError(404, 'Your candidate profile is not linked to this account.')

    const [[summaryRows], [skills], [applications], [documents]] = await Promise.all([
      pool.execute(
        `SELECT
           (SELECT COUNT(*) FROM applications WHERE candidate_id = ?) AS applications,
           (SELECT COUNT(*) FROM interviews i
              JOIN applications a ON a.application_id = i.application_id
              WHERE a.candidate_id = ? AND i.status = 'SCHEDULED') AS interviews,
           (SELECT COUNT(*) FROM candidate_documents
              WHERE candidate_id = ? AND document_type = 'RESUME' AND is_current = 1) AS resumes`,
        [candidate.candidate_id, candidate.candidate_id, candidate.candidate_id],
      ),
      pool.execute(
        `SELECT s.skill_name
         FROM candidate_skills cs
         JOIN skills s ON s.skill_id = cs.skill_id
         WHERE cs.candidate_id = ?
         ORDER BY s.skill_name`,
        [candidate.candidate_id],
      ),
      pool.execute(
        `SELECT application_id, status, applied_at
         FROM applications
         WHERE candidate_id = ?
         ORDER BY applied_at DESC
         LIMIT 5`,
        [candidate.candidate_id],
      ),
      pool.execute(
        `SELECT document_id, file_name, document_type, uploaded_at, verification_status
         FROM candidate_documents
         WHERE candidate_id = ? AND is_current = 1
         ORDER BY uploaded_at DESC`,
        [candidate.candidate_id],
      ),
    ])

    const summary = summaryRows[0] || {}
    const filled = [
      candidate.first_name,
      candidate.last_name,
      candidate.email,
      candidate.mobile,
      candidate.current_city,
      candidate.profile_summary,
      candidate.total_experience_years,
      skills.length,
      documents.length,
    ].filter((value) => value !== null && value !== undefined && value !== '').length
    const profileCompletion = Math.round((filled / 9) * 100)

    return res.json({
      profile: candidate,
      skills: skills.map((row) => row.skill_name),
      applications,
      documents,
      metrics: summary,
      profileCompletion,
      resume_status: documents.find((row) => row.document_type === 'RESUME') ? 'Uploaded' : 'Not uploaded',
    })
  } catch (error) {
    return next(error)
  }
}

export async function getMyProfile(req, res, next) {
  try {
    const candidate = await getCandidateForUser(req.authUser.user_id)
    if (!candidate) throw httpError(404, 'Your candidate profile is not linked to this account.')
    const [[education], [experience], [skills]] = await Promise.all([
      pool.execute('SELECT * FROM candidate_education WHERE candidate_id = ? ORDER BY passing_year DESC', [candidate.candidate_id]),
      pool.execute('SELECT * FROM candidate_experience WHERE candidate_id = ? ORDER BY start_date DESC', [candidate.candidate_id]),
      pool.execute(
        `SELECT cs.*, s.skill_name, s.skill_category
         FROM candidate_skills cs
         JOIN skills s ON s.skill_id = cs.skill_id
         WHERE cs.candidate_id = ?
         ORDER BY s.skill_name`,
        [candidate.candidate_id],
      ),
    ])
    return res.json({ profile: candidate, education, experience, skills })
  } catch (error) {
    return next(error)
  }
}

export async function listCandidateSkillOptions(req, res, next) {
  try {
    const [skills] = await pool.execute(
      'SELECT skill_id, skill_name, skill_category FROM skills ORDER BY skill_name',
    )
    return res.json({ skills })
  } catch (error) {
    return next(error)
  }
}

export async function updateMyProfile(req, res, next) {
  try {
    const candidate = await getCandidateForUser(req.authUser.user_id)
    if (!candidate) throw httpError(404, 'Your candidate profile is not linked to this account.')
    const allowed = [
      'email', 'mobile', 'date_of_birth', 'current_city', 'current_state',
      'total_experience_years', 'current_ctc', 'expected_ctc',
      'notice_period_days', 'profile_summary',
    ]
    const values = {}
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) values[key] = req.body[key] === '' ? null : req.body[key]
    }
    if (Object.keys(values).length === 0) throw httpError(400, 'No permitted profile fields were provided.')
    const numberLimits = {
      total_experience_years: { max: 999.9, whole: false },
      current_ctc: { max: 9999999999.99, whole: false },
      expected_ctc: { max: 9999999999.99, whole: false },
      notice_period_days: { max: 65535, whole: true },
    }
    for (const [key, limit] of Object.entries(numberLimits)) {
      if (values[key] === undefined || values[key] === null) continue
      const value = Number(values[key])
      if (!Number.isFinite(value) || value < 0 || value > limit.max || (limit.whole && !Number.isSafeInteger(value))) {
        throw httpError(400, `${key.replace(/_/g, ' ')} must be a valid non-negative ${limit.whole ? 'whole number' : 'number'}.`)
      }
      values[key] = value
    }
    if (values.email !== undefined && values.email !== null
      && (typeof values.email !== 'string' || values.email.length > 150
        || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email))) {
      throw httpError(400, 'Enter a valid email address.')
    }
    if (values.mobile !== undefined
      && (typeof values.mobile !== 'string' || !/^[0-9+().\-\s]{7,15}$/.test(values.mobile))) {
      throw httpError(400, 'Enter a valid phone number.')
    }
    if (values.current_city !== undefined && values.current_city !== null
      && (typeof values.current_city !== 'string' || values.current_city.length > 100)) {
      throw httpError(400, 'City must be 100 characters or fewer.')
    }
    if (values.current_state !== undefined && values.current_state !== null
      && (typeof values.current_state !== 'string' || values.current_state.length > 100)) {
      throw httpError(400, 'State must be 100 characters or fewer.')
    }
    if (values.date_of_birth !== undefined && values.date_of_birth !== null
      && (typeof values.date_of_birth !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(values.date_of_birth)
        || Number.isNaN(new Date(`${values.date_of_birth}T00:00:00.000Z`).getTime())
        || new Date(`${values.date_of_birth}T00:00:00.000Z`).toISOString().slice(0, 10) !== values.date_of_birth)) {
      throw httpError(400, 'Date of birth must be a valid date.')
    }
    if (values.mobile === null) throw httpError(400, 'Mobile number is required.')
    if (values.profile_summary !== undefined && values.profile_summary !== null
      && String(values.profile_summary).length > 5000) {
      throw httpError(400, 'Profile summary must be 5,000 characters or fewer.')
    }
    const setClause = Object.keys(values).map((key) => `${key} = ?`).join(', ')
    await pool.execute(`UPDATE candidates SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE candidate_id = ?`, [
      ...Object.values(values),
      candidate.candidate_id,
    ])
    return res.json({ message: 'Profile updated.' })
  } catch (error) {
    return next(error)
  }
}

export async function updateMyEducation(req, res, next) {
  try {
    const candidate = await getCandidateForUser(req.authUser.user_id)
    if (!candidate) throw httpError(404, 'Your candidate profile is not linked to this account.')
    const { educationId, qualification, specialization, institution, passingYear, grade } = req.body || {}
    if (typeof qualification !== 'string' || !qualification.trim()) throw httpError(400, 'Qualification is required.')
    if (qualification.trim().length > 100
      || (specialization && (typeof specialization !== 'string' || specialization.length > 100))
      || (institution && (typeof institution !== 'string' || institution.length > 200))
      || (grade && (typeof grade !== 'string' || grade.length > 30))) {
      throw httpError(400, 'Education details exceed the allowed field lengths.')
    }
    const year = passingYear === '' || passingYear === null || passingYear === undefined ? null : Number(passingYear)
    if (year !== null && (!Number.isSafeInteger(year) || year < 1900 || year > 2100)) {
      throw httpError(400, 'Passing year must be between 1900 and 2100.')
    }
    if (educationId) {
      const parsedEducationId = Number(educationId)
      if (!Number.isSafeInteger(parsedEducationId) || parsedEducationId < 1) throw httpError(400, 'Invalid education record.')
      await pool.execute(
        `UPDATE candidate_education
         SET qualification = ?, specialization = ?, institution = ?, passing_year = ?, grade_or_percentage = ?
         WHERE education_id = ? AND candidate_id = ?`,
        [qualification.trim(), typeof specialization === 'string' ? specialization.trim() || null : null, typeof institution === 'string' ? institution.trim() || null : null, year, typeof grade === 'string' ? grade.trim() || null : null, parsedEducationId, candidate.candidate_id],
      )
    } else {
      await pool.execute(
        `INSERT INTO candidate_education
         (candidate_id, qualification, specialization, institution, passing_year, grade_or_percentage)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [candidate.candidate_id, qualification.trim(), typeof specialization === 'string' ? specialization.trim() || null : null, typeof institution === 'string' ? institution.trim() || null : null, year, typeof grade === 'string' ? grade.trim() || null : null],
      )
    }
    return res.json({ message: 'Education saved.' })
  } catch (error) {
    return next(error)
  }
}

export async function updateMyExperience(req, res, next) {
  try {
    const candidate = await getCandidateForUser(req.authUser.user_id)
    if (!candidate) throw httpError(404, 'Your candidate profile is not linked to this account.')
    const { experienceId, employerName, designation, startDate, endDate, isCurrent } = req.body || {}
    if (typeof employerName !== 'string' || !employerName.trim()
      || typeof designation !== 'string' || !designation.trim()) {
      throw httpError(400, 'Employer and designation are required.')
    }
    if (employerName.trim().length > 200 || designation.trim().length > 120) {
      throw httpError(400, 'Employer or designation exceeds the allowed field length.')
    }
    if (typeof isCurrent !== 'boolean') throw httpError(400, 'Select whether this is your current role.')
    if (isCurrent && endDate) throw httpError(400, 'A current experience record cannot have an end date.')
    const validDate = (value) => typeof value === 'string'
      && /^\d{4}-\d{2}-\d{2}$/.test(value)
      && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())
      && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
    if ((startDate && !validDate(startDate)) || (endDate && !validDate(endDate))) {
      throw httpError(400, 'Enter valid experience dates.')
    }
    if (startDate && endDate && endDate < startDate) throw httpError(400, 'End date cannot be before start date.')
    if (experienceId) {
      const parsedExperienceId = Number(experienceId)
      if (!Number.isSafeInteger(parsedExperienceId) || parsedExperienceId < 1) throw httpError(400, 'Invalid experience record.')
      await pool.execute(
        `UPDATE candidate_experience
         SET employer_name = ?, designation = ?, start_date = ?, end_date = ?, is_current = ?
         WHERE experience_id = ? AND candidate_id = ?`,
        [employerName.trim(), designation.trim(), startDate || null, isCurrent ? null : (endDate || null), isCurrent ? 1 : 0, parsedExperienceId, candidate.candidate_id],
      )
    } else {
      await pool.execute(
        `INSERT INTO candidate_experience
         (candidate_id, employer_name, designation, start_date, end_date, is_current)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [candidate.candidate_id, employerName.trim(), designation.trim(), startDate || null, isCurrent ? null : (endDate || null), isCurrent ? 1 : 0],
      )
    }
    return res.json({ message: 'Experience saved.' })
  } catch (error) {
    return next(error)
  }
}

export async function updateMySkills(req, res, next) {
  try {
    const candidate = await getCandidateForUser(req.authUser.user_id)
    if (!candidate) throw httpError(404, 'Your candidate profile is not linked to this account.')
    const { skillIds, skillId, experienceYears, proficiency } = req.body
    if (skillIds !== undefined) {
      if (!Array.isArray(skillIds)) throw httpError(400, 'skillIds must be an array.')
      const parsedSkillIds = [...new Set(skillIds.map(Number))]
      if (parsedSkillIds.some((id) => !Number.isSafeInteger(id) || id < 1)) {
        throw httpError(400, 'Skill IDs must be positive whole numbers.')
      }
      const connection = await pool.getConnection()
      try {
        await connection.beginTransaction()
        const [existingSkills] = await connection.execute(
          `SELECT skill_id, experience_years, proficiency
           FROM candidate_skills WHERE candidate_id = ?`,
          [candidate.candidate_id],
        )
        const existingById = new Map(existingSkills.map((row) => [Number(row.skill_id), row]))
        await connection.execute('DELETE FROM candidate_skills WHERE candidate_id = ?', [candidate.candidate_id])
        for (const id of parsedSkillIds) {
          const existing = existingById.get(id)
          await connection.execute(
            `INSERT INTO candidate_skills
             (candidate_id, skill_id, experience_years, proficiency)
             VALUES (?, ?, ?, ?)`,
            [candidate.candidate_id, id, existing?.experience_years ?? null, existing?.proficiency ?? null],
          )
        }
        await connection.commit()
      } catch (error) {
        await connection.rollback()
        throw error
      } finally {
        connection.release()
      }
    } else {
      if (!Number.isSafeInteger(Number(skillId)) || Number(skillId) < 1) throw httpError(400, 'A valid skill ID is required.')
      const parsedExperience = experienceYears === '' || experienceYears === null || experienceYears === undefined
        ? null
        : Number(experienceYears)
      if (parsedExperience !== null && (!Number.isFinite(parsedExperience) || parsedExperience < 0 || parsedExperience > 999.9)) {
        throw httpError(400, 'Skill experience must be between 0 and 999.9 years.')
      }
      if (proficiency && !['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'].includes(proficiency)) {
        throw httpError(400, 'Select a valid proficiency level.')
      }
      await pool.execute(
        `INSERT INTO candidate_skills
         (candidate_id, skill_id, experience_years, proficiency)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE experience_years = VALUES(experience_years), proficiency = VALUES(proficiency)`,
        [candidate.candidate_id, Number(skillId), parsedExperience, proficiency || null],
      )
    }
    return res.json({ message: 'Skills saved.' })
  } catch (error) {
    return next(error)
  }
}

export async function getOpenRequirements(req, res, next) {
  try {
    const candidate = await getCandidateForUser(req.authUser.user_id)
    if (!candidate) throw httpError(404, 'Your candidate profile is not linked to this account.')
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : ''
    const location = typeof req.query.location === 'string' ? req.query.location.trim() : ''
    const conditions = ["r.status = 'OPEN'"]
    const params = [candidate.candidate_id]
    if (search) {
      conditions.push('(r.job_title LIKE ? OR r.job_description LIKE ? OR jp.profile_name LIKE ?)')
      params.push(...Array(3).fill(`%${search}%`))
    }
    if (location) {
      conditions.push('(r.work_location LIKE ? OR c.company_name LIKE ?)')
      params.push(`%${location}%`, `%${location}%`)
    }
    const [requirements] = await pool.execute(
      `SELECT r.requirement_id, r.requirement_number, r.job_title, r.job_description,
              r.headcount, r.work_mode, r.work_location, r.experience_min_years,
              r.experience_max_years, r.employment_schedule, r.target_join_date,
              r.salary_min, r.salary_max, r.hours_per_week, c.company_name,
              jp.profile_name AS job_profile_title,
              EXISTS (
                SELECT 1 FROM applications applied
                WHERE applied.requirement_id = r.requirement_id
                  AND applied.candidate_id = ?
              ) AS has_applied
       FROM job_requirements r
       JOIN service_orders so ON so.service_order_id = r.service_order_id
       JOIN agreements a ON a.agreement_id = so.agreement_id
       JOIN customers c ON c.customer_id = a.customer_id
       JOIN job_profiles jp ON jp.job_profile_id = r.job_profile_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY r.published_at DESC, r.created_at DESC`,
      params,
    )
    return res.json({ requirements })
  } catch (error) {
    return next(error)
  }
}

export async function applyForRequirement(req, res, next) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const candidate = await getCandidateForUser(req.authUser.user_id)
    if (!candidate) throw httpError(404, 'Your candidate profile is not linked to this account.')
    const requirementId = Number(req.params.requirementId)
    if (!Number.isSafeInteger(requirementId) || requirementId < 1) throw httpError(400, 'Invalid requirement ID.')
    const [requirements] = await connection.execute(
      `SELECT requirement_id, requirement_number, job_title
       FROM job_requirements
       WHERE requirement_id = ? AND status = 'OPEN'
       FOR UPDATE`,
      [requirementId],
    )
    if (!requirements[0]) throw httpError(404, 'Requirement is not open.')
    const [existing] = await connection.execute(
      'SELECT application_id FROM applications WHERE requirement_id = ? AND candidate_id = ? LIMIT 1',
      [requirementId, candidate.candidate_id],
    )
    if (existing[0]) throw httpError(409, 'You have already applied to this requirement.')
    const applicationNumber = `APP-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`
    const [result] = await connection.execute(
      `INSERT INTO applications
       (application_number, requirement_id, candidate_id, status, source)
       VALUES (?, ?, ?, 'APPLIED', 'SELF_APPLIED')`,
      [applicationNumber, requirementId, candidate.candidate_id],
    )
    await connection.execute(
      `INSERT INTO application_status_history
       (application_id, old_status, new_status, changed_by, change_reason)
       VALUES (?, NULL, 'APPLIED', ?, 'Candidate applied through the portal.')`,
      [result.insertId, req.authUser.user_id],
    )
    await notifyAssignedRecruiters(connection, requirementId, {
      type: 'CANDIDATE_APPLIED',
      title: `New application: ${requirements[0].requirement_number}`,
      message: `A candidate applied for ${requirements[0].job_title}.`,
      targetUrl: '/app/recruiter/applications',
    })
    await connection.commit()
    return res.status(201).json({ applicationId: result.insertId, message: 'Application submitted.' })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
}

export async function withdrawApplication(req, res, next) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const candidate = await getCandidateForUser(req.authUser.user_id)
    if (!candidate) throw httpError(404, 'Your candidate profile is not linked to this account.')
    const applicationId = Number(req.params.applicationId)
    if (!Number.isSafeInteger(applicationId) || applicationId < 1) throw httpError(400, 'Invalid application ID.')
    const [rows] = await connection.execute(
      `SELECT a.status, r.requirement_id, r.requirement_number, r.job_title
       FROM applications a
       INNER JOIN job_requirements r ON r.requirement_id = a.requirement_id
       WHERE a.application_id = ? AND a.candidate_id = ?
       FOR UPDATE`,
      [applicationId, candidate.candidate_id],
    )
    if (!rows[0] || !['APPLIED', 'SCREENING', 'SHORTLISTED'].includes(rows[0].status)) {
      throw httpError(409, 'This application cannot be withdrawn.')
    }
    await connection.execute(
      "UPDATE applications SET status = 'WITHDRAWN' WHERE application_id = ?",
      [applicationId],
    )
    await connection.execute(
      `INSERT INTO application_status_history
       (application_id, old_status, new_status, changed_by, change_reason)
       VALUES (?, ?, 'WITHDRAWN', ?, 'Candidate withdrew through the portal.')`,
      [applicationId, rows[0].status, req.authUser.user_id],
    )
    await notifyAssignedRecruiters(connection, rows[0].requirement_id, {
      type: 'CANDIDATE_WITHDREW',
      title: `Application withdrawn: ${rows[0].requirement_number}`,
      message: `A candidate withdrew from ${rows[0].job_title}.`,
      targetUrl: '/app/recruiter/applications',
    })
    await connection.commit()
    return res.json({ message: 'Application withdrawn.' })
  } catch (error) {
    await connection.rollback()
    return next(error)
  } finally {
    connection.release()
  }
}

export async function getMyApplications(req, res, next) {
  try {
    const candidate = await getCandidateForUser(req.authUser.user_id)
    if (!candidate) throw httpError(404, 'Your candidate profile is not linked to this account.')
    const [applications] = await pool.execute(
      `SELECT a.application_id, a.application_number, a.status, a.source, a.applied_at,
              r.requirement_id, r.requirement_number, r.job_title, r.work_location
       FROM applications a
       JOIN job_requirements r ON r.requirement_id = a.requirement_id
       WHERE a.candidate_id = ?
       ORDER BY a.applied_at DESC`,
      [candidate.candidate_id],
    )
    return res.json({ applications })
  } catch (error) {
    return next(error)
  }
}

export async function getMyApplicationTimeline(req, res, next) {
  try {
    const candidate = await getCandidateForUser(req.authUser.user_id)
    if (!candidate) throw httpError(404, 'Your candidate profile is not linked to this account.')
    const applicationId = Number(req.params.applicationId)
    const [rows] = await pool.execute(
      'SELECT application_id, status, applied_at, rejection_reason FROM applications WHERE application_id = ? AND candidate_id = ?',
      [applicationId, candidate.candidate_id],
    )
    if (!rows[0]) throw httpError(404, 'Application not found.')
    const [history] = await pool.execute(
      `SELECT old_status, new_status, change_reason, changed_at
       FROM application_status_history
       WHERE application_id = ?
       ORDER BY changed_at`,
      [applicationId],
    )
    const events = history.length > 0
      ? history
      : [{
        old_status: null,
        new_status: rows[0].status,
        change_reason: 'Application received.',
        changed_at: rows[0].applied_at,
      }]
    return res.json({ application: rows[0], history: events })
  } catch (error) {
    return next(error)
  }
}

export async function uploadMyResume(req, res, next) {
  try {
    if (!req.file) throw httpError(400, 'A PDF resume is required.')
    if (req.file.mimetype !== 'application/pdf'
      || req.file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw httpError(400, 'Upload a valid PDF resume.')
    }
    if (req.file.size > 10 * 1024 * 1024) throw httpError(413, 'Resume must not exceed 10 MB.')

    const candidate = await getCandidateForUser(req.authUser.user_id)
    if (!candidate) throw httpError(404, 'Your candidate profile is not linked to this account.')
    const storageRoot = process.env.PRIVATE_FILE_STORAGE_PATH?.trim()
    if (!storageRoot || !path.isAbsolute(storageRoot)) {
      throw httpError(500, 'Private file storage is not configured.')
    }
    const relativeDirectory = path.join('candidates', String(candidate.candidate_id), 'resumes')
    const directory = path.resolve(storageRoot, relativeDirectory)
    const relativeCheck = path.relative(path.resolve(storageRoot), directory)
    if (relativeCheck.startsWith('..') || path.isAbsolute(relativeCheck)) throw httpError(500, 'Invalid storage path.')
    await mkdir(directory, { recursive: true })
    const fileName = `resume-${randomUUID()}.pdf`
    const absolutePath = path.join(directory, fileName)
    await writeFile(absolutePath, req.file.buffer, { flag: 'wx' })

    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      await connection.execute(
        'UPDATE candidate_documents SET is_current = 0, current_resume_marker = 0 WHERE candidate_id = ? AND document_type = ?',
        [candidate.candidate_id, 'RESUME'],
      )
      const sha256 = createHash('sha256').update(req.file.buffer).digest('hex')
      const [result] = await connection.execute(
        `INSERT INTO candidate_documents
         (candidate_id, document_type, file_name, file_path, is_current, verification_status,
          uploaded_by, file_size_bytes, detected_mime_type, sha256, malware_scan_status, current_resume_marker)
         VALUES (?, 'RESUME', ?, ?, 1, 'PENDING', ?, ?, 'application/pdf', ?, 'PENDING', 1)`,
        [candidate.candidate_id, req.file.originalname, path.join(relativeDirectory, fileName), req.authUser.user_id, req.file.size, sha256],
      )
      await connection.commit()
      return res.status(201).json({
        resume: {
          document_id: result.insertId,
          file_name: req.file.originalname,
          upload_date: new Date().toISOString(),
          file_size: req.file.size,
          download_url: '/api/candidate/resume/download',
          verification_status: 'PENDING',
          malware_scan_status: 'PENDING',
        },
      })
    } catch (error) {
      await connection.rollback()
      await unlink(absolutePath)
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    return next(error)
  }
}

export async function downloadMyResume(req, res, next) {
  try {
    const candidate = await getCandidateForUser(req.authUser.user_id)
    if (!candidate) throw httpError(404, 'Your candidate profile is not linked to this account.')
    const [rows] = await pool.execute(
      `SELECT document_id, file_name, file_path, file_size_bytes
       FROM candidate_documents
       WHERE candidate_id = ? AND document_type = 'RESUME' AND is_current = 1
       ORDER BY uploaded_at DESC
       LIMIT 1`,
      [candidate.candidate_id],
    )
    if (!rows[0]) return res.status(404).json({ message: 'No resume uploaded yet.', resume: null })
    const storageRoot = process.env.PRIVATE_FILE_STORAGE_PATH?.trim()
    if (!storageRoot || !path.isAbsolute(storageRoot)) throw httpError(500, 'Private file storage is not configured.')
    const absolutePath = path.resolve(storageRoot, rows[0].file_path)
    const relative = path.relative(path.resolve(storageRoot), absolutePath)
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw httpError(404, 'Resume not found.')
    const fileStats = await stat(absolutePath)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Length', fileStats.size)
    res.setHeader('Content-Disposition', `attachment; filename="${String(rows[0].file_name).replace(/[^a-zA-Z0-9._-]/g, '_')}"`)
    return createReadStream(absolutePath).pipe(res)
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ message: 'Resume file not found.' })
    return next(error)
  }
}

export async function getMyResume(req, res, next) {
    try {
      const candidate = await getCandidateForUser(req.authUser.user_id)
      if (!candidate) throw httpError(404, 'Your candidate profile is not linked to this account.')
      const [rows] = await pool.execute(
        `SELECT document_id, file_name, uploaded_at, file_size_bytes,
                verification_status, malware_scan_status
         FROM candidate_documents
         WHERE candidate_id = ? AND document_type = 'RESUME' AND is_current = 1
         ORDER BY uploaded_at DESC
         LIMIT 1`,
        [candidate.candidate_id],
      )
      if (!rows[0]) return res.status(404).json({ message: 'No resume uploaded yet.', resume: null })
      return res.json({
        resume: {
          resume_id: rows[0].document_id,
          file_name: rows[0].file_name,
          upload_date: rows[0].uploaded_at,
          file_size: rows[0].file_size_bytes,
          download_url: '/api/candidate/resume/download',
          verification_status: rows[0].verification_status,
          malware_scan_status: rows[0].malware_scan_status,
        },
      })
    } catch (error) {
      return next(error)
    }
}