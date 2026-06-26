/* eslint-disable */
import { logger } from '../utils/logger.js';

export class NotificationService {
  async sendReceipt(paymentId: string): Promise<void> {
    logger.info({ paymentId }, 'Sending payment receipt notification');
    // In production, sends email via SES or SNS
  }

  async sendAlert(message: string): Promise<void> {
    logger.warn({ message }, 'Alert notification sent');
  }
}
