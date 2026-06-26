export interface CreateCustomerInput {
    email: string;
    name: string;
    metadata: Record<string, string>;
}

export interface IStripeCustomerService {
    createCustomer(input: CreateCustomerInput): Promise<{ customerId: string }>;
}
