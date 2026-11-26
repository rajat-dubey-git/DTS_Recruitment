import { useEffect, useState } from 'react'
import { ExternalLink, FileText, X } from 'lucide-react'
import { workspaceApi } from '../api/workspace'

export default function AgreementSampleTemplateModal({ onClose }: { onClose: () => void }) {
  const [pdfUrl, setPdfUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null

    workspaceApi.downloadAdminAgreementSample()
      .then((document) => {
        objectUrl = URL.createObjectURL(document)
        if (active) setPdfUrl(objectUrl)
        else URL.revokeObjectURL(objectUrl)
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load the sample agreement.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [])

  return (
    <div className="customer-modal-overlay agreement-template-overlay" style={{ zIndex: 1000 }}>
      <div
        className="customer-modal agreement-template-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-title"
        style={{
          maxWidth: '1000px',
          width: '95vw',
          height: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="customer-modal-heading" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem' }}>
          <div>
            <div className="eyebrow">AGREEMENT PREVIEW</div>
            <h2 id="template-title" style={{ fontSize: '1.25rem' }}>Sample generated agreement</h2>
            <p style={{ margin: 0 }}>This sample uses the same PDF generator and wording as customer agreement drafts.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {pdfUrl && (
              <a
                className="btn btn-outline"
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={15} /> Open PDF
              </a>
            )}
            <button type="button" className="customer-modal-close" onClick={onClose} aria-label="Close sample agreement">
              <X size={20} />
            </button>
          </div>
        </div>

        {loading && (
          <div className="customer-empty" role="status">
            <FileText size={20} /> Loading sample agreement…
          </div>
        )}
        {error && <div className="form-error" role="alert">{error}</div>}
        {pdfUrl && (
          <iframe
            title="Sample generated agreement PDF"
            src={pdfUrl}
            style={{ width: '100%', flex: 1, minHeight: 0, border: 0, marginTop: '0.75rem' }}
          />
        )}
      </div>
    </div>
  )
}
