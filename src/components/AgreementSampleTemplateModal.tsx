import { FileText, Printer, X } from 'lucide-react'

export default function AgreementSampleTemplateModal({ onClose }: { onClose: () => void }) {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="customer-modal-overlay agreement-template-overlay" style={{ zIndex: 1000 }}>
      <div
        className="customer-modal agreement-template-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-title"
        style={{ maxWidth: '850px', width: '95vw', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="customer-modal-heading" style={{ borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem' }}>
          <div>
            <div className="eyebrow" style={{ color: '#b91c1c', fontWeight: 700 }}>STANDARD DOCUMENT SPECIFICATION</div>
            <h2 id="template-title" style={{ fontSize: '1.25rem' }}>Recruitment Services Agreement — Sample Draft Template</h2>
            <p style={{ margin: 0 }}>Layout and clauses as approved in development specifications (Phases 1–2).</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button type="button" className="btn btn-outline" onClick={handlePrint} title="Print or save as PDF">
              <Printer size={15} /> Print
            </button>
            <button type="button" className="customer-modal-close" onClick={onClose} aria-label="Close template preview">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="agreement-template-content" style={{ padding: '1.5rem 0', color: '#1f2937', lineHeight: 1.6 }}>
          {/* Watermark Banner */}
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '2px dashed #ef4444',
              borderRadius: '8px',
              padding: '1rem',
              textAlign: 'center',
              marginBottom: '1.5rem',
            }}
          >
            <strong style={{ color: '#b91c1c', fontSize: '1.1rem', letterSpacing: '0.05em' }}>
              SAMPLE DRAFT — SUBJECT TO COMMERCIAL &amp; LEGAL APPROVAL
            </strong>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#7f1d1d' }}>
              This draft demonstrates standard contract terms, pricing formulas, and required clauses. Not an executed contract.
            </p>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem' }}>MASTER RECRUITMENT SERVICES AGREEMENT</h1>
            <p style={{ color: '#6b7280', margin: 0 }}>Agreement Reference: DTS-AGR-YYYYMM-XXXX · Version: 1.0 (Draft)</p>
          </div>

          {/* Section 1 */}
          <section style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.25rem', marginBottom: '0.75rem' }}>
              1. PARTIES &amp; EFFECTIVE DATE
            </h3>
            <p>
              This Recruitment Services Agreement (&quot;Agreement&quot;) is entered into between:
            </p>
            <ul>
              <li><strong>DTS Consulting Private Limited</strong> (&quot;DTS&quot; or &quot;Provider&quot;), having its registered office in India; and</li>
              <li><strong>[Customer Legal Entity Name]</strong> (&quot;Customer&quot;), registered under the Companies Act with offices at [Customer Registered Address].</li>
            </ul>
            <p>
              <strong>Effective Date:</strong> [Date of Activation] · <strong>Term:</strong> Twelve (12) months from Effective Date, subject to mutual renewal.
            </p>
          </section>

          {/* Section 2 */}
          <section style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.25rem', marginBottom: '0.75rem' }}>
              2. SCOPE OF SERVICES
            </h3>
            <p>
              DTS agrees to provide recruitment, candidate sourcing, screening, and placement services for designated roles selected by Customer:
            </p>
            <ol style={{ paddingLeft: '1.25rem' }}>
              <li><strong>Permanent Customer-Payroll Placement:</strong> Sourcing and evaluation of candidates for direct employment on Customer&apos;s payroll.</li>
              <li><strong>Contract Staffing (DTS Payroll):</strong> Deployment of qualified professionals employed by DTS and assigned to Customer project work.</li>
              <li><strong>Schedule Options:</strong> Services cover both Full-Time (standard 40–48 hrs/week) and Part-Time staffing schedules as specified in approved Service Orders.</li>
            </ol>
          </section>

          {/* Section 3 */}
          <section style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.25rem', marginBottom: '0.75rem' }}>
              3. COMMERCIAL TERMS &amp; PRICING FORMULA
            </h3>
            <p>
              Fees shall be billed according to the approved service line snapshot in Indian Rupees (INR):
            </p>
            <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '1rem', margin: '0.75rem 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #d1d5db', textAlign: 'left' }}>
                    <th style={{ padding: '0.5rem' }}>Employment Model</th>
                    <th style={{ padding: '0.5rem' }}>Schedule</th>
                    <th style={{ padding: '0.5rem' }}>Agreed Fee Basis</th>
                    <th style={{ padding: '0.5rem' }}>Calculation Formula</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.5rem' }}><strong>Customer Payroll</strong></td>
                    <td style={{ padding: '0.5rem' }}>Full-Time / Part-Time</td>
                    <td style={{ padding: '0.5rem' }}>Monthly Salary</td>
                    <td style={{ padding: '0.5rem' }}><strong>1.0 × Agreed Monthly Gross Salary</strong></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem' }}><strong>DTS Payroll Staffing</strong></td>
                    <td style={{ padding: '0.5rem' }}>Full-Time / Part-Time</td>
                    <td style={{ padding: '0.5rem' }}>Annual CTC</td>
                    <td style={{ padding: '0.5rem' }}><strong>10% × Agreed Annual CTC</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <small style={{ color: '#6b7280' }}>
              * Statutory Goods and Services Tax (GST) will be charged in addition at prevailing rates. Fees apply per successfully joined candidate.
            </small>
          </section>

          {/* Section 4 */}
          <section style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.25rem', marginBottom: '0.75rem' }}>
              4. CANDIDATE CONSENT &amp; DATA PRIVACY
            </h3>
            <p>
              In accordance with applicable privacy regulations:
            </p>
            <ul>
              <li>DTS shall obtain verified candidate consent naming Customer and role prior to submitting candidate profiles or resumes.</li>
              <li>Customer is granted access to shared resumes solely for hiring evaluation. Authorized download links expire <strong>24 hours</strong> after issue.</li>
              <li>Customer shall not disclose candidate PII or resumes to third parties without prior written consent.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.25rem', marginBottom: '0.75rem' }}>
              5. REPLACEMENT GUARANTEE
            </h3>
            <p>
              If a placed candidate voluntarily leaves or is discharged for performance within <strong>90 days</strong> of joining date, DTS shall provide a replacement candidate at no additional recruitment fee, provided invoices are paid within agreed payment terms.
            </p>
          </section>

          {/* Section 6 - Signatures */}
          <section style={{ marginTop: '2rem', borderTop: '2px solid #e5e7eb', paddingTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>6. SIGNATURE &amp; ACTIVATION</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '1rem' }}>
                <strong style={{ display: 'block', marginBottom: '1rem' }}>For Customer:</strong>
                <p style={{ margin: '0 0 0.5rem', color: '#6b7280' }}>Authorized Signatory: _________________________</p>
                <p style={{ margin: '0 0 0.5rem', color: '#6b7280' }}>Name: [Authorized Contact Name]</p>
                <p style={{ margin: '0 0 0.5rem', color: '#6b7280' }}>Designation: [Signatory Title]</p>
                <p style={{ margin: 0, color: '#6b7280' }}>Date: ____ / ____ / ________</p>
              </div>
              <div style={{ border: '1px solid #d1d5db', borderRadius: '6px', padding: '1rem' }}>
                <strong style={{ display: 'block', marginBottom: '1rem' }}>For DTS Consulting:</strong>
                <p style={{ margin: '0 0 0.5rem', color: '#6b7280' }}>Authorized Signatory: _________________________</p>
                <p style={{ margin: '0 0 0.5rem', color: '#6b7280' }}>Name: DTS Systems Administrator</p>
                <p style={{ margin: '0 0 0.5rem', color: '#6b7280' }}>Designation: Director of Operations</p>
                <p style={{ margin: 0, color: '#6b7280' }}>Date: ____ / ____ / ________</p>
              </div>
            </div>
          </section>
        </div>

        <div className="customer-modal-actions agreement-template-actions" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
          <button type="button" className="btn btn-outline" onClick={onClose}>Close preview</button>
        </div>
      </div>
    </div>
  )
}
