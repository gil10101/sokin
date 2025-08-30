import { Request, Response } from 'express'
import { db } from '../config/firebase'
import logger from '../utils/logger'
import { cacheGet, cacheSet } from '../utils/redisCache'

export class DashboardController {
  static async getDashboard(req: Request, res: Response) {
    try {
      const userId = req.user?.uid
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' })
      }

      const cacheKey = `dashboard:${userId}`
      const cached = await cacheGet<any>(cacheKey)
      if (cached) {
        return res.json(cached)
      }

      if (!db) {
        return res.status(500).json({ error: 'Database not initialized' })
      }

      const [expensesSnap, budgetsSnap, notificationsSnap] = await Promise.all([
        db
          .collection('expenses')
          .where('userId', '==', userId)
          .orderBy('date', 'desc')
          .limit(50) // Reduced from 100 to 50 for faster loading
          .get(),
        db
          .collection('budgets')
          .where('userId', '==', userId)
          .limit(20) // Add limit for budgets
          .get(),
        db
          .collection('notifications')
          .where('userId', '==', userId)
          .orderBy('createdAt', 'desc')
          .limit(5) // Reduced from 10 to 5 notifications
          .get(),
      ])

      const expenses = expensesSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const budgets = budgetsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const notifications = notificationsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

      const payload = { expenses, budgets, notifications }
      await cacheSet(cacheKey, payload, 600) // Cache for 10 minutes instead of 5

      return res.json(payload)
    } catch (e) {
      logger.error('Dashboard endpoint error', { error: (e as Error).message })
      return res.status(500).json({ error: 'Failed to load dashboard data' })
    }
  }
}


