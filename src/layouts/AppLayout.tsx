
import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'

import {
  Bell,
  Check,
  LogOut,
  Menu,
} from 'lucide-react'

import { useAuth } from '../context/AuthContext'
import { navByRole } from '../data/navigation'
import { notificationsApi } from '../api/notifications'
import type { NotificationItem } from '../api/notifications'

function notificationDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export default function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationError, setNotificationError] = useState('')
  const [notificationBusy, setNotificationBusy] = useState(false)

  const loadNotifications = useCallback(async () => {
    if (!user?.userId) return
    try {
      const result = await notificationsApi.list()
      setNotifications(result.notifications)
      setUnreadCount(result.unreadCount)
      setNotificationError('')
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Unable to load notifications.')
    }
  }, [user?.userId])

  useEffect(() => {
    void loadNotifications()
    const timer = window.setInterval(() => void loadNotifications(), 60000)
    return () => window.clearInterval(timer)
  }, [loadNotifications])

  if (!user) return null

  const items = navByRole[user.role]

  const currentPage = items.find(
    (item) => item.path === location.pathname
  )

  const pageTitle = currentPage?.label ?? 'Workspace'

  const openNotification = async (notification: NotificationItem) => {
    setNotificationBusy(true)
    setNotificationError('')
    try {
      if (!notification.read_at) {
        await notificationsApi.markRead(notification.notification_id)
        const readAt = new Date().toISOString()
        setNotifications((current) => current.map((item) => item.notification_id === notification.notification_id
          ? { ...item, read_at: readAt }
          : item))
        setUnreadCount((count) => Math.max(0, count - 1))
      }
      const target = notification.target_url?.startsWith('/app/')
        ? notification.target_url
        : '/app/dashboard'
      setNotificationPanelOpen(false)
      navigate(target)
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Unable to open this notification.')
    } finally {
      setNotificationBusy(false)
    }
  }

  const markAllRead = async () => {
    setNotificationBusy(true)
    setNotificationError('')
    try {
      await notificationsApi.markAllRead()
      const readAt = new Date().toISOString()
      setNotifications((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? readAt })))
      setUnreadCount(0)
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : 'Unable to mark notifications as read.')
    } finally {
      setNotificationBusy(false)
    }
  }

  return (
    <div className="app-shell">

      {/* Sidebar */}
      {mobileNavOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>

        <button
          type="button"
          className="brand brand-link"
          onClick={() => { void navigate('/app/dashboard') }}
          aria-label="Go to dashboard"
          style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, width: '100%' }}
        >
          <div className="brand-mark">D</div>

          <div>
            <strong>DTS</strong>
            <small>Recruitment Suite</small>
          </div>
        </button>

        <div className="nav-caption">WORKSPACE</div>

        <nav>
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end
              onClick={() => setMobileNavOpen(false)}
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
          <div className="help-card">
            <strong>Need assistance?</strong>
            <p>Contact your DTS system administrator.</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="main-area">

        <header className="topbar">

          <button
            className="mobile-menu"
            type="button"
            aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            <Menu />
          </button>

          <div className="crumb">
            Workspace <span>/</span> {pageTitle}
          </div>

          <div className="top-actions">
            <div className="notification-menu">
              <button
                className="icon-button notification-button"
                type="button"
                title="Notifications"
                aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
                aria-expanded={notificationPanelOpen}
                onClick={() => {
                  setNotificationPanelOpen((open) => !open)
                  if (!notificationPanelOpen) void loadNotifications()
                }}
              >
                <Bell size={17} />
                {unreadCount > 0 && <span className="notification-count">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </button>
              {notificationPanelOpen && (
                <section className="notification-panel" aria-label="Notifications">
                  <div className="notification-panel-heading">
                    <div>
                      <strong>Notifications</strong>
                      <small>{unreadCount} unread</small>
                    </div>
                    <button
                      type="button"
                      className="notification-mark-all"
                      disabled={notificationBusy || unreadCount === 0}
                      onClick={() => void markAllRead()}
                    >
                      <Check size={14} /> Mark all read
                    </button>
                  </div>
                  {notificationError && <p className="notification-error" role="alert">{notificationError}</p>}
                  <div className="notification-list">
                    {notifications.length === 0 ? (
                      <p className="notification-empty">You’re all caught up.</p>
                    ) : notifications.map((notification) => (
                      <button
                        key={notification.notification_id}
                        type="button"
                        className={`notification-item ${notification.read_at ? '' : 'unread'}`}
                        disabled={notificationBusy}
                        onClick={() => void openNotification(notification)}
                      >
                        <span className="notification-item-dot" />
                        <span className="notification-item-content">
                          <strong>{notification.title}</strong>
                          <span>{notification.message}</span>
                          <small>{notificationDate(notification.created_at)}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>

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
            </div>

            <button
              className="icon-button"
              title="Sign out"
              aria-label="Sign out"
              type="button"
              onClick={async () => {
                setLogoutError('')
                try {
                  await logout()
                  navigate('/login')
                } catch (error) {
                  setLogoutError(
                    error instanceof Error ? error.message : 'Unable to sign out.',
                  )
                }
              }}
            >
              <LogOut size={17} />
            </button>

          </div>
        </header>

        {logoutError && <div className="form-error" role="alert">{logoutError}</div>}

        <section className="page-content">
          <Outlet />
        </section>

      </main>
    </div>
  )
}