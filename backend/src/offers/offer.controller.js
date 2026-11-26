import { createReadStream } from 'node:fs'
import {
  getCandidateOfferDocument,
  listAdminOfferSelections,
  listCandidateOffers,
  respondToCandidateOffer,
  sendOffer,
} from './offer.service.js'

export async function listEligibleOfferSelections(_req, res, next) {
  try {
    return res.json(await listAdminOfferSelections())
  } catch (error) {
    return next(error)
  }
}

export async function createAdminOffer(req, res, next) {
  try {
    return res.status(201).json(await sendOffer(
      req.params.selectionId,
      req.body,
      req.file,
      req.authUser,
    ))
  } catch (error) {
    return next(error)
  }
}

export async function createRecruiterOffer(req, res, next) {
  try {
    return res.status(201).json(await sendOffer(
      req.params.selectionId,
      req.body,
      req.file,
      req.authUser,
    ))
  } catch (error) {
    return next(error)
  }
}

export async function listMyOffers(req, res, next) {
  try {
    return res.json(await listCandidateOffers(req.authUser.user_id))
  } catch (error) {
    return next(error)
  }
}

export async function downloadMyOffer(req, res, next) {
  try {
    const document = await getCandidateOfferDocument(req.authUser.user_id, req.params.offerId)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`)
    const stream = createReadStream(document.absolutePath)
    stream.once('error', next)
    return stream.pipe(res)
  } catch (error) {
    return next(error)
  }
}

export async function respondToMyOffer(req, res, next) {
  try {
    const result = await respondToCandidateOffer(
      req.authUser.user_id,
      req.params.offerId,
      req.body?.response,
    )
    if (result.expired) return res.status(409).json({ message: result.message })
    return res.json({ message: result.message })
  } catch (error) {
    return next(error)
  }
}
