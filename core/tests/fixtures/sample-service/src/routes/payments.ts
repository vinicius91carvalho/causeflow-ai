/* eslint-disable */
import { Router } from 'express';
import { PaymentService } from '../services/payment.service.js';
import { PaymentRepository } from '../repositories/payment.repository.js';
import { logger } from '../utils/logger.js';

const router = Router();
const repo = new PaymentRepository();
const service = new PaymentService(repo);

router.post('/', async (req, res) => {
  try {
    const payment = await service.createPayment(req.body);
    res.status(201).json(payment);
  } catch (err) {
    logger.error({ err }, 'Failed to create payment');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const payment = await service.getPayment(req.params.id);
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json(payment);
  } catch (err) {
    logger.error({ err }, 'Failed to get payment');
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/refund', async (req, res) => {
  try {
    const result = await service.refundPayment(req.params.id);
    res.json(result);
  } catch (err) {
    logger.error({ err }, 'Failed to refund payment');
    res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as paymentRoutes };
