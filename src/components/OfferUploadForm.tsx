import { useState } from 'react'
import type { FormEvent } from 'react'

type Props = {
  busy?: boolean
  onSubmit: (form: FormData) => Promise<{ message: string }>
  onSuccess?: (message: string) => void
}

export default function OfferUploadForm({ busy = false, onSubmit, onSuccess }: Props) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    const formElement = event.currentTarget
    const values = new FormData(formElement)
    const file = values.get('offerPdf')
    if (!(file instanceof File) || file.size === 0) {
      setError('Select the offer PDF to upload.')
      return
    }
    setSaving(true)
    try {
      const result = await onSubmit(values)
      formElement.reset()
      onSuccess?.(result.message)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to send the offer.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="offer-upload-form" onSubmit={(event) => void submit(event)}>
      <label>
        Offer PDF *
        <input name="offerPdf" type="file" accept="application/pdf,.pdf" required />
      </label>
      <label>
        Offer reference (optional)
        <input name="offerReference" maxLength={100} />
      </label>
      <label>
        Offered CTC (optional)
        <input name="offeredCtc" type="number" min="0.01" step="0.01" />
      </label>
      <label>
        Expires on (optional)
        <input name="expiresOn" type="date" />
      </label>
      <label>
        Proposed joining date (optional)
        <input name="proposedJoiningDate" type="date" />
      </label>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="btn btn-primary" type="submit" disabled={saving || busy}>
        {saving || busy ? 'Uploading…' : 'Upload and send offer'}
      </button>
    </form>
  )
}
