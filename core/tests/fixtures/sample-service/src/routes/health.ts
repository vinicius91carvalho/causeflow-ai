/* eslint-disable */
import { Router } from 'express';
import { PaymentRepository } from '../repositories/payment.repository.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const repo = new PaymentRepository();
    await repo.healthCheck();
    res.json({ status: 'healthy', service: 'payment-service', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'unhealthy', service: 'payment-service' });
  }
});

export { router as healthRoutes };
