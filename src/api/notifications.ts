export type NotificationItem = {
  notification_id: number
  notification_type: string
  title: string
  message: string
  target_url: string | null
  read_at: string | null
  created_at: string
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/notifications${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || 'Notification request failed.')
  return result as T
}

export const notificationsApi = {
  list: () => request<{ notifications: NotificationItem[]; unreadCount: number }>('/'),

  markRead: (notificationId: number) => request<{ message: string }>(
    `/${notificationId}/read`,
    { method: 'POST' },
  ),

  markAllRead: () => request<{ message: string }>('/read-all', { method: 'POST' }),
}
