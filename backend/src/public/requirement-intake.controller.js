import {
  getRequirementIntake,
  submitRequirementIntake,
} from '../admin/requirement-intake.service.js'

export async function readRequirementIntake(req, res, next) {
  try {
    return res.json(await getRequirementIntake(req.params.token))
  } catch (error) {
    return next(error)
  }
}

export async function submitRequirementIntakeForm(req, res, next) {
  try {
    return res.json(await submitRequirementIntake(req.params.token, req.body))
  } catch (error) {
    return next(error)
  }
}
