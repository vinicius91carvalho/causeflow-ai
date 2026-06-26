import { getStripeClient } from './stripe-client.js';
import type { IStripeCustomerService, CreateCustomerInput } from '../domain/stripe-customer.port.js';

export class StripeCustomerService implements IStripeCustomerService {
    async createCustomer(input: CreateCustomerInput): Promise<{ customerId: string }> {
        const stripe = getStripeClient();
        const customer = await stripe.customers.create({
            email: input.email,
            name: input.name,
            metadata: input.metadata,
        });
        return { customerId: customer.id };
    }
}
