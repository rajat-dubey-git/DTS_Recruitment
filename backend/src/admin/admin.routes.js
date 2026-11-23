import { Router } from 'express'
import {
  deleteTableRecord,
  insertTableRecord,
  listTableRecords,
  listTables,
  updateTableRecord,
} from './admin.controller.js'
import { requireAdmin, requireAuth } from '../auth/auth.middleware.js'

const router = Router()

router.use(requireAuth, requireAdmin)
router.get('/tables', listTables)
router.get('/tables/:table/records', listTableRecords)
router.post('/tables/:table/records', insertTableRecord)
router.put('/tables/:table/records', updateTableRecord)
router.delete('/tables/:table/records', deleteTableRecord)

export default router
