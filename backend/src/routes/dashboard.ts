import { Router } from 'express'
import { DashboardController } from '../controllers/dashboardController'
import { auth } from '../middleware/auth'

const router = Router()

router.get('/', auth, DashboardController.getDashboard)

export default router


