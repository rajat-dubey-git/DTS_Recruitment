import { getDashboardAnalytics } from './dashboard.service.js'

export async function readDashboardAnalytics(req, res, next) {
  try {
    return res.json(await getDashboardAnalytics(req.authUser))
  } catch (error) {
    return next(error)
  }
}
