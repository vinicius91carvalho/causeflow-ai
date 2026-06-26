export interface VerifyEmailInput {
    email: string;
    code: string;
}
export declare class VerifyEmailUseCase {
    execute(input: VerifyEmailInput): Promise<{
        success: true;
    }>;
}
