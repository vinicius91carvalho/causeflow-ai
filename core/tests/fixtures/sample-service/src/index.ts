/* eslint-disable */
import express from 'express';
import { config } from './config.js';
import { paymentRoutes } from './routes/payments.js';
import { healthRoutes } from './routes/health.js';
import { authMiddleware } from './middleware/auth.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { logger } from './utils/logger.js';

const app = express();

app.use(express.json());
app.use(rateLimitMiddleware);

app.use('/health', healthRoutes);
app.use('/payments', authMiddleware, paymentRoutes);

app.listen(config.port, () => {
  logger.info(`payment-service started on port ${config.port}`);
});

export default app;
