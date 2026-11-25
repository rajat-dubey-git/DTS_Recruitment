import {
  activateSignedAgreement,
  createCustomerAgreement,
  getAdminAgreementDetail,
  getAdminCatalog,
  getAgreementDocument,
  getCustomerAgreementDetail,
  getCustomerCatalog,
  getPendingSignedDocument,
  listAdminAgreements,
  listCustomerAgreements,
  requestAdminAgreementDecision,
  requestCustomerAgreementChanges,
  saveAdminAgreementTerms,
  uploadSignedAgreement,
} from './agreement.service.js'
import { archiveDownloadCopy } from './document-storage.js'

export async function readAdminCatalog(_req, res, next) {
  try {
    return res.json(await getAdminCatalog())
  } catch (error) {
    return next(error)
  }
}

export async function readCustomerCatalog(req, res, next) {
  try {
    return res.json(await getCustomerCatalog(req.authUser.user_id))
  } catch (error) {
    return next(error)
  }
}

export async function readCustomerAgreements(req, res, next) {
  try {
    return res.json({ agreements: await listCustomerAgreements(req.authUser.user_id) })
  } catch (error) {
    return next(error)
  }
}

export async function createCustomerAgreementRequest(req, res, next) {
  try {
    const agreement = await createCustomerAgreement(req.authUser, req.body)
    return res.status(201).json(agreement)
  } catch (error) {
    return next(error)
  }
}

export async function readCustomerAgreement(req, res, next) {
  try {
    return res.json(await getCustomerAgreementDetail(req.authUser.user_id, req.params.agreementId))
  } catch (error) {
    return next(error)
  }
}

export async function readAdminAgreements(_req, res, next) {
  try {
    return res.json({ agreements: await listAdminAgreements() })
  } catch (error) {
    return next(error)
  }
}

export async function readAdminAgreement(req, res, next) {
  try {
    return res.json(await getAdminAgreementDetail(req.params.agreementId))
  } catch (error) {
    return next(error)
  }
}

export async function updateAdminAgreementTerms(req, res, next) {
  try {
    const agreement = await saveAdminAgreementTerms(
      req.params.agreementId,
      req.params.versionId,
      req.body,
      req.authUser.user_id,
    )
    return res.json(agreement)
  } catch (error) {
    return next(error)
  }
}

export async function reviewAdminAgreement(req, res, next) {
  try {
    const agreement = await requestAdminAgreementDecision(
      req.params.agreementId,
      req.params.versionId,
      req.body,
      req.authUser.user_id,
    )
    return res.json(agreement)
  } catch (error) {
    return next(error)
  }
}

export async function activateAdminAgreement(req, res, next) {
  try {
    const agreement = await activateSignedAgreement(
      req.params.agreementId,
      req.params.versionId,
      req.body,
      req.authUser.user_id,
    )
    return res.json(agreement)
  } catch (error) {
    return next(error)
  }
}

function sendDocument(res, next, getDocument, audience) {
  return getDocument()
    .then(async ({ absolutePath, fileName }) => {
      await archiveDownloadCopy(absolutePath, fileName, audience)
      res.download(absolutePath, fileName, (error) => {
        if (error) next(error)
      })
    })
    .catch(next)
}

export function downloadCustomerDraft(req, res, next) {
  return sendDocument(res, next, () => getAgreementDocument(
    req.params.agreementId,
    req.params.versionId,
    'draft',
    req.authUser,
  ), 'customer')
}

export function downloadCustomerSignedCopy(req, res, next) {
  return sendDocument(res, next, () => getAgreementDocument(
    req.params.agreementId,
    req.params.versionId,
    'signed',
    req.authUser,
  ), 'customer')
}

export function downloadAdminSignedCopy(req, res, next) {
  return sendDocument(res, next, () => getPendingSignedDocument(
    req.params.agreementId,
    req.params.versionId,
  ), 'admin')
}

export function downloadAdminAgreement(req, res, next) {
  return sendDocument(res, next, () => getAgreementDocument(
    req.params.agreementId,
    req.params.versionId,
    'draft',
    { role: 'ADMIN', user_id: 0 },
  ), 'admin')
}

export async function uploadCustomerSignedCopy(req, res, next) {
  try {
    const agreement = await uploadSignedAgreement(
      req.authUser,
      req.params.agreementId,
      req.params.versionId,
      req.file,
    )
    return res.json(agreement)
  } catch (error) {
    return next(error)
  }
}

export async function requestCustomerChanges(req, res, next) {
  try {
    const agreement = await requestCustomerAgreementChanges(
      req.authUser,
      req.params.agreementId,
      req.params.versionId,
      req.body,
    )
    return res.json(agreement)
  } catch (error) {
    return next(error)
  }
}
