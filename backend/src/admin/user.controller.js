import { inviteUser, acceptInvitation, deleteUserAccount } from './user.service.js'

export async function createInvitation(req, res, next) {
  try {
    const result = await inviteUser(req.body, req.authUser.user_id)
    return res.status(201).json(result)
  } catch (error) {
    return next(error)
  }
}

export async function completeInvitation(req, res, next) {
  try {
    const result = await acceptInvitation(
      req.body?.token,
      req.body?.password,
    )
    return res.json(result)
  } catch (error) {
    return next(error)
  }
}

export async function removeUser(req, res, next) {
  try {
    const result = await deleteUserAccount(req.params.userId, req.authUser.user_id)
    return res.json(result)
  } catch (error) {
    return next(error)
  }
}