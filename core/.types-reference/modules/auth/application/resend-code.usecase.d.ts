export interface ResendCodeInput {
    email: string;
}
export interface ResendCodeOutput {
    codeDeliveryDetails?: {
        destination?: string;
        deliveryMedium?: string;
        attributeName?: string;
    };
}
export declare class ResendCodeUseCase {
    execute(input: ResendCodeInput): Promise<ResendCodeOutput>;
}
