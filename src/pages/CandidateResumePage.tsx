import { useEffect, useState } from 'react'
import { Download, FileText, Upload } from 'lucide-react'

type Resume = {
  resume_id: number
  file_name: string
  upload_date: string
  file_size: number
  download_url: string
  verification_status: string
  malware_scan_status: string
}

export default function CandidateResumePage() {
  const [resume, setResume] = useState<Resume | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function loadResume() {
    try {
      setLoading(true)
      setError('')
      const response = await fetch('/api/candidate/resume', { credentials: 'include' })
      if (response.status === 404) {
        setResume(null)
        return
      }
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Error loading resume')
      setResume(result.resume)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Error loading resume')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadResume()
  }, [])

  async function uploadResume(event: React.FormEvent) {
    event.preventDefault()
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('resume', file)
      const response = await fetch('/api/candidate/resume', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Error uploading resume')
      setResume(result.resume)
      setFile(null)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Error uploading resume')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Resume Management</h1>
        <p className="text-sm text-slate-500 mt-1">Upload, replace or download your current resume.</p>
      </div>

      {loading && <p className="text-sm text-slate-500">Loading...</p>}
      {error && <div className="form-error" role="alert">{error}</div>}

      {!loading && (
        <div className="max-w-2xl space-y-4">
          {resume && (
            <div className="bg-white border border-slate-200 rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                  <FileText size={24} className="text-slate-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 truncate">{resume.file_name}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(resume.upload_date).toLocaleString()} · Verification: {resume.verification_status} · Security scan: {resume.malware_scan_status}
                  </p>
                </div>
                <a className="btn btn-outline" href={resume.download_url} download>
                  <Download size={16} /> Download
                </a>
              </div>
            </div>
          )}

          {resume && (resume.verification_status !== 'VERIFIED' || resume.malware_scan_status !== 'CLEAN') && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
              Your resume is stored privately. It can only be shared with a customer after administrator verification and a clean security scan.
            </div>
          )}

          <form onSubmit={(event) => void uploadResume(event)} className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <Upload size={20} className="text-slate-500" />
              <div>
                <h2 className="font-medium text-slate-800">{resume ? 'Replace resume' : 'Upload resume'}</h2>
                <p className="text-xs text-slate-500">PDF only, maximum 10 MB.</p>
              </div>
            </div>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="block w-full text-sm border border-slate-300 rounded-lg p-2"
            />
            <button type="submit" className="btn btn-primary mt-4" disabled={!file || uploading}>
              {uploading ? 'Uploading...' : resume ? 'Replace resume' : 'Upload resume'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
