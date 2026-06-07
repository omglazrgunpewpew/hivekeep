import { Hono } from 'hono'
import {
  listFiles,
  createFile,
  getFileById,
  updateFile,
  deleteFile,
  buildShareUrl,
} from '@/server/services/file-storage'
import type { AppVariables } from '@/server/app'
import { createLogger } from '@/server/logger'

const log = createLogger('routes:file-storage')

export const fileStorageRoutes = new Hono<{ Variables: AppVariables }>()

// GET /api/file-storage — list all stored files
fileStorageRoutes.get('/', async (c) => {
  const agentId = c.req.query('agentId')
  const files = await listFiles(agentId || undefined)
  return c.json({ files })
})

// POST /api/file-storage — upload a new file
fileStorageRoutes.post('/', async (c) => {
  const user = c.get('user') as { id: string; name: string }

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const agentId = formData.get('agentId') as string | null
  const name = formData.get('name') as string | null
  const description = formData.get('description') as string | null
  const isPublic = formData.get('isPublic') as string | null
  const password = formData.get('password') as string | null
  const expiresIn = formData.get('expiresIn') as string | null
  const readAndBurn = formData.get('readAndBurn') as string | null

  if (!file || !(file instanceof File)) {
    return c.json(
      { error: { code: 'INVALID_FILE', message: 'A file is required' } },
      400,
    )
  }

  if (!agentId) {
    return c.json(
      { error: { code: 'VALIDATION_ERROR', message: 'agentId is required' } },
      400,
    )
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await createFile({
      agentId,
      name: name || file.name,
      originalName: file.name,
      buffer,
      mimeType: file.type || 'application/octet-stream',
      description: description || undefined,
      isPublic: isPublic !== 'false',
      password: password || undefined,
      expiresIn: expiresIn ? Number(expiresIn) : undefined,
      readAndBurn: readAndBurn === 'true',
    })

    log.info({ fileId: result.id, agentId, fileName: file.name, size: file.size }, 'File uploaded to storage')
    return c.json({ file: result }, 201)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    const code = message.includes('too large') ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR'
    return c.json({ error: { code, message } }, 400)
  }
})

// GET /api/file-storage/:id — get file metadata
fileStorageRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const file = await getFileById(id)

  if (!file) {
    return c.json(
      { error: { code: 'FILE_NOT_FOUND', message: 'File not found' } },
      404,
    )
  }

  return c.json({ file })
})

// PATCH /api/file-storage/:id — update file metadata
fileStorageRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id')
  const body = (await c.req.json()) as {
    name?: string
    description?: string | null
    isPublic?: boolean
    password?: string | null
    expiresIn?: number | null
    readAndBurn?: boolean
  }

  const updated = await updateFile(id, body)

  if (!updated) {
    return c.json(
      { error: { code: 'FILE_NOT_FOUND', message: 'File not found' } },
      404,
    )
  }

  return c.json({ file: updated })
})

// DELETE /api/file-storage/:id — delete a file
fileStorageRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const deleted = await deleteFile(id)

  if (!deleted) {
    return c.json(
      { error: { code: 'FILE_NOT_FOUND', message: 'File not found' } },
      404,
    )
  }

  return c.json({ success: true })
})
