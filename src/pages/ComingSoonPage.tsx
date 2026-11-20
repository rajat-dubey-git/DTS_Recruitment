
import { useParams } from 'react-router-dom'

const pageNames: Record<string, string> = {
  users: 'User Management',
  'job-profiles': 'Job Profiles',
  requirements: 'Requirements',
  'my-requirements': 'My Requirements',
  candidates: 'Candidates',
  interviews: 'Interviews',
  invoices: 'Invoices',
  reports: 'Reports',
  'assigned-requirements': 'Assigned Requirements',
  applications: 'Applications',
  'my-profile': 'My Profile',
  'browse-jobs': 'Browse Jobs',
  'my-applications': 'My Applications',
  documents: 'Documents',
  learning: 'Learning',
}

export default function ComingSoonPage() {
  const { section } = useParams()

  const title = section
    ? pageNames[section] ?? 'Workspace'
    : 'Workspace'

  return (
    <div className="dashboard">

      <div className="page-heading">
        <div>
          <div className="eyebrow">WORKSPACE</div>
          <h1>{title}</h1>
          <p>
            This module is planned for an upcoming development phase.
          </p>
        </div>
      </div>

      <div className="panel" style={{ padding: 40 }}>
        <h3>{title}</h3>
        <p>
          This section will be implemented as part of the DTS
          Recruitment Platform development roadmap.
        </p>
      </div>

    </div>
  )
}