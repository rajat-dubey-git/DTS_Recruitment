import { useEffect, useState } from 'react'
import { CheckCircle, Download, FileText, Info, Plus, Send, Trash2, Upload } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { workspaceApi } from '../api/workspace'
import type { AgreementListItem } from '../api/workspace'
import AgreementSampleTemplateModal from '../components/AgreementSampleTemplateModal'

export default function CustomerRequirementsPage() {
  const [intakes, setIntakes] = useState<{ intake_id: number; company_name: string; job_title: string; headcount: number; status: string; created_at: string }[]>([])
  const [requirements, setRequirements] = useState<{ requirement_id: number; requirement_number: string; job_title: string; status: string; created_at: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [createError, setCreateError] = useState('')
  const [intakeData, setIntakeData] = useState<{ customer_id: number; job_title: string; job_description: string; headcount: number; work_mode: string; work_location: string; experience_min_years: number; experience_max_years: number; salary_min: number; salary_max: number; employment_schedule: string; hours_per_week: number; target_join_date: string } | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let active = true
    Promise.all([
      workspaceApi.listCustomerAgreements(), // this lists intakes too? need to check
      // Actually need to check - there might be a separate API for intakes
    ]).then(() => {}).catch((e) => setError(e instanceof Error ? e.message : 'Error loading data')).finally(() => setLoading(false))
    // TODO: implement listCustomerRequirementIntakes API
    return () => { active = false }
  }, [])

  const handleCreate = async () => {
    setShowCreate(true)
  }

  const handleSubmit = async (values: any) => {
    setCreateError('')
    try {
      const result = await workspaceApi.submitPublicRequirementIntake('', values)
      setShowCreate(false)
      setIntakeData(null)
      // Refresh data
    } catch (err: any) {
      setCreateError(err instanceof Error ? err.message : 'Unable to submit requirement')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My Requirements</h1>
          <p className="text-sm text-slate-500 mt-1">View and track your hiring requirements</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition">
            <Plus className="w-3.5 h-3.5" /> Add New Requirement
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="customer-modal-overlay">
          <div className="customer-modal" role="dialog" aria-modal="true" aria-labelledby="create-requirement-title">
            <div className="customer-modal-heading">
              <div>
                <h2 id="create-requirement-title">Create Hiring Requirement</h2>
                <p>Submit your hiring needs for review by the DTS team.</p>
              </div>
              <button type="button" className="customer-modal-close" onClick={() => setShowCreate(false)} aria-label="Close">�</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(intakeData!); }}>
              {/* form fields */}
              <button type="submit" className="btn btn-primary">Submit</button>
              <button type="button" className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
            </form>
          </div>
        </div>
      )}

      <p className="text-sm text-slate-500">Under construction - requirements flow via customer intake forms</p>
    </div>
  )
}
