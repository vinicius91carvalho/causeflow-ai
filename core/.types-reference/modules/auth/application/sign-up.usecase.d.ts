export interface SignUpInput {
    email: string;
    password: string;
    name: string;
}
export interface SignUpOutput {
    userSub: string;
    codeDeliveryDetails?: {
        destination?: string;
        deliveryMedium?: string;
        attributeName?: string;
    };
}
export declare class SignUpUseCase {
    execute(input: SignUpInput): Promise<SignUpOutput>;
}
