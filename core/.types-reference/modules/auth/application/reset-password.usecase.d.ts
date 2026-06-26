export interface ResetPasswordInput {
    email: string;
    code: string;
    newPassword: string;
}
export declare class ResetPasswordUseCase {
    execute(input: ResetPasswordInput): Promise<{
        success: true;
    }>;
}
