import test from 'node:test'
import assert from 'node:assert/strict'
import {
  attachRequirementSkills,
  normalizeRequirementSkills,
} from '../src/admin/requirement-skills.js'

test('normalizes custom skill names and rejects invalid entries', () => {
  assert.deepEqual(
    normalizeRequirementSkills([' React ', 'SQL', 'react', '']),
    ['React', 'SQL'],
  )
  assert.throws(() => normalizeRequirementSkills(['x'.repeat(101)]), /100 characters/)
  assert.throws(() => normalizeRequirementSkills(42), /text or a list/)
})

test('attaches custom skills and reuses matching catalog skills', async () => {
  const linkedSkills = []
  const connection = {
    async execute(query, values) {
      if (query.includes('SELECT skill_id')) {
        return [values[0] === 'React' ? [{ skill_id: 7 }] : [], []]
      }
      if (query.startsWith('INSERT INTO skills')) {
        return [{ insertId: 12 }, []]
      }
      if (query.includes('INSERT INTO job_requirement_skills')) {
        linkedSkills.push(values)
        return [{ affectedRows: 1 }, []]
      }
      throw new Error(`Unexpected query: ${query}`)
    },
  }

  await attachRequirementSkills(connection, 55, ['React', 'Node.js'])

  assert.deepEqual(linkedSkills, [[55, 7], [55, 12]])
})
