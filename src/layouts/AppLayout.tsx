
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { navByRole } from '../data/navigation'

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (!user) return null

  const items = navByRole[user.role]

  const currentPage = items.find(
    (item) => item.path === location.pathname
  )

  const pageTitle = currentPage?.label ?? 'Workspace'

  return (
    <div className="app-shell">

      {/* Sidebar */}
      <aside className="sidebar">

        <div className="brand">
          <div className="brand-mark">D</div>

          <div>
            <strong>DTS</strong>
            <small>Recruitment Suite</small>
          </div>
        </div>

        <div className="nav-caption">WORKSPACE</div>

        <nav>
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end
              className={({ isActive }) =>
                `nav-item ${isActive ? 'active' : ''}`
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">

          <button className="nav-item" type="button">
            <Settings size={18} />
            <span>Settings</span>
          </button>

          <div className="help-card">
            <strong>Need assistance?</strong>
            <p>Contact the DTS support team.</p>
            <a href="mailto:support@dts.com">
              Get support ↗
            </a>
          </div>

        </div>
      </aside>

      {/* Main content */}
      <main className="main-area">

        <header className="topbar">

          <button className="mobile-menu" type="button">
            <Menu />
          </button>

          <div className="crumb">
            Workspace <span>/</span> {pageTitle}
          </div>

          <div className="top-actions">

            <div className="search-box">
              <Search size={16} />
              <input placeholder="Search anything..." />
            </div>

            <button className="icon-button" type="button">
              <Bell size={18} />
              <i />
            </button>

            <div className="user-menu">

              <div className="avatar">
                {user.fullName
                  .split(' ')
                  .map((x) => x[0])
                  .slice(0, 2)
                  .join('')}
              </div>

              <div>
                <strong>{user.fullName}</strong>
                <small>{user.role}</small>
              </div>

              <ChevronDown size={15} />

            </div>

            <button
              className="icon-button"
              title="Sign out"
              type="button"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              <LogOut size={17} />
            </button>

          </div>
        </header>

        <section className="page-content">
          <Outlet />
        </section>

      </main>
    </div>
  )
}