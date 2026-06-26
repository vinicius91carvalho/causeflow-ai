/* eslint-disable */
import { v4 as uuid } from 'uuid';
import type { PaymentRepository } from '../repositories/payment.repository.js';
import { NotificationService } from './notification.service.js';
import { logger } from '../utils/logger.js';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
}

const processingLock = new Map<string, boolean>();

export class PaymentService {
  private notifier = new NotificationService();

  constructor(private repo: PaymentRepository) {}

  async createPayment(data: { amount: number; currency: string }): Promise<Payment> {
    const payment: Payment = {
      id: uuid(),
      amount: data.amount,
      currency: data.currency,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    await this.repo.save(payment);
    return payment;
  }

  async processPayment(paymentId: string): Promise<Payment> {
    if (processingLock.has(paymentId)) {
      throw new Error('Payment already being processed');
    }

    processingLock.set(paymentId, true);
    try {
      const payment = await this.repo.findById(paymentId);
      if (!payment) throw new Error('Payment not found');

      payment.status = 'processed';
      await this.repo.save(payment);
      await this.notifier.sendReceipt(payment.id);

      return payment;
    } finally {
      processingLock.delete(paymentId);
    }
  }

  async getPayment(id: string): Promise<Payment | null> {
    return this.repo.findById(id);
  }

  async refundPayment(id: string): Promise<Payment> {
    const payment = await this.repo.findById(id);
    if (!payment) throw new Error('Payment not found');
    if (payment.status !== 'processed') throw new Error('Cannot refund unprocessed payment');

    payment.status = 'refunded';
    await this.repo.save(payment);
    logger.info({ paymentId: id }, 'Payment refunded');
    return payment;
  }
}
