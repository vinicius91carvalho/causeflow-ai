export interface ForgotPasswordInput {
    email: string;
}
export declare class ForgotPasswordUseCase {
    execute(input: ForgotPasswordInput): Promise<{
        success: true;
    }>;
}
