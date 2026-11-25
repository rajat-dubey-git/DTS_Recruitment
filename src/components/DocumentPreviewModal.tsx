import React, { useState } from 'react'
import { X, ExternalLink, ShieldCheck, Clock, FileText } from 'lucide-react'

interface DocumentPreviewModalProps {
  shareId: number | null
  candidateName: string
  isOpen: boolean
  onClose: () => void
  expiresAt?: string | null
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  shareId,
  candidateName,
  isOpen,
  onClose,
  expiresAt,
}) => {
  const [iframeError, setIframeError] = useState(false)

  if (!isOpen || !shareId) return null

  const previewUrl = `/api/documents/resumes/${shareId}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative flex flex-col w-full max-w-4xl h-[85vh] bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-100 text-blue-600">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                Resume: {candidateName}
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                  Secure 24-hour share
                </span>
              </h2>
              {expiresAt && (
                <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  Access valid until: {new Date(expiresAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open New Tab
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body iframe */}
        <div className="relative flex-1 bg-slate-100 p-2">
          {!iframeError ? (
            <iframe
              src={previewUrl}
              title={`Resume Preview - ${candidateName}`}
              className="w-full h-full rounded border border-slate-200 bg-white"
              onError={() => setIframeError(true)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-white rounded">
              <p className="text-slate-600 mb-4">Could not load preview in frame.</p>
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
              >
                Open in Full Window
              </a>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
          <span>Confidential profile shared via DTS Consulting Platform</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 font-medium"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  )
}
