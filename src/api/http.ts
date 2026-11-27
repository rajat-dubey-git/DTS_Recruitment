import axios from 'axios'

export const http = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 10000,
  headers: { Accept: 'application/json' },
})

const refreshHttp = axios.create({
  baseURL: '/api',
  withCredentials: true,
  timeout: 10000,
  headers: { Accept: 'application/json' },
})

declare module 'axios' {
  interface InternalAxiosRequestConfig<D = any> {
    sessionRetry?: boolean
  }
}

let refreshRequest: Promise<void> | null = null

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error)

    const request = error.config
    const url = request?.url ?? ''
    const isSessionEndpoint = [
      '/auth/login',
      '/auth/logout',
      '/auth/refresh',
      '/auth/invitations/',
    ].some((endpoint) => url.startsWith(endpoint))

    if (
      error.response?.status !== 401
      || !request
      || request.sessionRetry
      || isSessionEndpoint
    ) {
      return Promise.reject(error)
    }

    request.sessionRetry = true
    try {
      if (!refreshRequest) {
        refreshRequest = refreshHttp
          .post('/auth/refresh')
          .then(() => undefined)
          .finally(() => {
            refreshRequest = null
          })
      }
      await refreshRequest
      return http(request)
    } catch (refreshError) {
      return Promise.reject(refreshError)
    }
  },
)