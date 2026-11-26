import { createHash, randomUUID } from 'node:crypto'
import { constants, createReadStream, createWriteStream } from 'node:fs'
import { copyFile, mkdir, open, rename, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(moduleDirectory, '../../..')

function storageError(message, statusCode = 500) {
  return Object.assign(new Error(message), { statusCode })
}

export function getPrivateStorageRoot() {
  const configuredPath = process.env.PRIVATE_FILE_STORAGE_PATH?.trim()
  if (!configuredPath || !path.isAbsolute(configuredPath)) {
    throw storageError('PRIVATE_FILE_STORAGE_PATH must be set to an absolute private folder path.')
  }

  const root = path.resolve(configuredPath)
  const relativeToRepository = path.relative(repositoryRoot, root)
  const isInsideRepository = relativeToRepository !== ''
    && relativeToRepository !== '..'
    && !relativeToRepository.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relativeToRepository)
  if (
    relativeToRepository === '' ||
    (isInsideRepository && path.basename(root).toLowerCase() !== 'dts_private_storage')
  ) {
    throw storageError('Private document storage inside the application repository must use the DTS_Private_Storage folder.')
  }

  return root
}

export async function ensurePrivateStorageDirectory(relativeDirectory) {
  const root = getPrivateStorageRoot()
  const directory = path.resolve(root, relativeDirectory)
  const relative = path.relative(root, directory)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw storageError('Invalid private storage directory.')
  }
  await mkdir(directory, { recursive: true })
  return directory
}

export function resolvePrivateStoragePath(storageKey) {
  if (typeof storageKey !== 'string' || !storageKey.trim()) {
    throw storageError('Document is not available.', 404)
  }
  const root = getPrivateStorageRoot()
  const absolutePath = path.resolve(root, storageKey)
  const relative = path.relative(root, absolutePath)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw storageError('Document is not available.', 404)
  }
  return absolutePath
}

export async function fileMetadata(filePath) {
  const fileStat = await stat(filePath)
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk)
  }
  return {
    size: fileStat.size,
    sha256: hash.digest('hex'),
  }
}

export async function storeSignedPdf(tempPath, agreementId, versionNumber) {
  const fileHandle = await open(tempPath, 'r')
  try {
    const header = Buffer.alloc(5)
    const { bytesRead } = await fileHandle.read(header, 0, header.length, 0)
    if (bytesRead !== 5 || header.toString('ascii') !== '%PDF-') {
      throw storageError('Upload must be a valid PDF file.', 400)
    }
  } finally {
    await fileHandle.close()
  }

  const relativeDirectory = path.join('agreements', String(agreementId))
  const directory = await ensurePrivateStorageDirectory(relativeDirectory)
  const fileName = `signed-v${versionNumber}-${randomUUID()}.pdf`
  const destination = path.join(directory, fileName)
  await rename(tempPath, destination)
  const metadata = await fileMetadata(destination)

  return {
    storageKey: path.join(relativeDirectory, fileName),
    absolutePath: destination,
    ...metadata,
  }
}

export async function storePrivatePdf(tempPath, relativeDirectory, namePrefix) {
  const fileHandle = await open(tempPath, 'r')
  try {
    const header = Buffer.alloc(5)
    const { bytesRead } = await fileHandle.read(header, 0, header.length, 0)
    if (bytesRead !== 5 || header.toString('ascii') !== '%PDF-') {
      throw storageError('Upload must be a valid PDF file.', 400)
    }
  } finally {
    await fileHandle.close()
  }

  const directory = await ensurePrivateStorageDirectory(relativeDirectory)
  const safePrefix = String(namePrefix).replace(/[^a-zA-Z0-9._-]/g, '_')
  const fileName = `${safePrefix}-${randomUUID()}.pdf`
  const destination = path.join(directory, fileName)
  await rename(tempPath, destination)
  return {
    storageKey: path.join(relativeDirectory, fileName),
    absolutePath: destination,
    ...await fileMetadata(destination),
  }
}

export async function createDraftPdf(agreementId, versionNumber, buildDocument) {
  const relativeDirectory = path.join('agreements', String(agreementId))
  const directory = await ensurePrivateStorageDirectory(relativeDirectory)
  const fileName = `draft-v${versionNumber}-${randomUUID()}.pdf`
  const absolutePath = path.join(directory, fileName)
  const document = buildDocument()
  const output = createWriteStream(absolutePath, { flags: 'wx' })

  await new Promise((resolve, reject) => {
    output.once('finish', resolve)
    output.once('error', reject)
    document.once('error', reject)
    document.pipe(output)
    document.end()
  })

  const metadata = await fileMetadata(absolutePath)
  return {
    storageKey: path.join(relativeDirectory, fileName),
    absolutePath,
    ...metadata,
  }
}

export async function removePrivateFile(filePath) {
  if (!filePath) return
  await rm(filePath, { force: true })
}

export async function archiveDownloadCopy(absolutePath, fileName, audience) {
  if (!absolutePath || !fileName) throw storageError('Download archive source is invalid.')
  const folder = audience === 'customer' ? 'Customer_Downloads' : 'Admin_Downloads'
  const directory = await ensurePrivateStorageDirectory(folder)
  const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')
  const extension = path.extname(safeName)
  const baseName = path.basename(safeName, extension)
  const uniqueName = `${baseName}-${randomUUID()}${extension}`
  const destination = path.join(directory, uniqueName)
  await copyFile(absolutePath, destination, constants.COPYFILE_EXCL)
  return {
    storageKey: path.join(folder, uniqueName),
    absolutePath: destination,
    ...(await fileMetadata(destination)),
  }
}
