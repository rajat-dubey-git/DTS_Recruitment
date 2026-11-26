function httpError(message, statusCode) {
  return Object.assign(new Error(message), { statusCode })
}

export function normalizeRequirementSkills(value) {
  if (value === undefined || value === null || value === '') return []
  if (typeof value !== 'string' && !Array.isArray(value)) {
    throw httpError('Skills must be supplied as text or a list.', 400)
  }

  const entries = typeof value === 'string' ? value.split(/[,\n]/) : value
  const names = []
  const seen = new Set()
  for (const entry of entries) {
    if (typeof entry !== 'string') {
      throw httpError('Each skill must be text.', 400)
    }
    const name = entry.trim()
    if (!name) continue
    if (name.length > 100) {
      throw httpError('Each skill must be 100 characters or fewer.', 400)
    }
    const key = name.toLocaleLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      names.push(name)
    }
  }
  if (names.length > 100) {
    throw httpError('Enter no more than 100 required skills.', 400)
  }
  return names
}

export function parseStoredRequirementSkills(value) {
  if (value === undefined || value === null || value === '') return []
  if (Array.isArray(value)) return normalizeRequirementSkills(value)
  if (typeof value !== 'string') {
    throw httpError('Stored requirement skills could not be read.', 500)
  }
  try {
    return normalizeRequirementSkills(JSON.parse(value))
  } catch (error) {
    if (error?.statusCode) throw error
    throw httpError('Stored requirement skills could not be read.', 500)
  }
}

export async function attachRequirementSkills(connection, requirementId, skillNames) {
  for (const skillName of skillNames) {
    const [existingSkills] = await connection.execute(
      `SELECT skill_id
       FROM skills
       WHERE LOWER(TRIM(skill_name)) = LOWER(?)
       LIMIT 1
       FOR UPDATE`,
      [skillName],
    )
    let skillId = existingSkills[0]?.skill_id
    if (!skillId) {
      const [result] = await connection.execute(
        'INSERT INTO skills (skill_name, skill_category) VALUES (?, NULL)',
        [skillName],
      )
      skillId = result.insertId
    }
    await connection.execute(
      `INSERT INTO job_requirement_skills (requirement_id, skill_id, is_mandatory)
       VALUES (?, ?, 1)`,
      [requirementId, skillId],
    )
  }
}
