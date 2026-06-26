import { Hono } from 'hono';
import type { AppEnv } from '../../../shared/infra/http/hono-types.js';
import { SignUpUseCase } from '../application/sign-up.usecase.js';
import { VerifyEmailUseCase } from '../application/verify-email.usecase.js';
import { ResendCodeUseCase } from '../application/resend-code.usecase.js';
import { ForgotPasswordUseCase } from '../application/forgot-password.usecase.js';
import { ResetPasswordUseCase } from '../application/reset-password.usecase.js';
export interface AuthUseCases {
    signUp: SignUpUseCase;
    verifyEmail: VerifyEmailUseCase;
    resendCode: ResendCodeUseCase;
    forgotPassword: ForgotPasswordUseCase;
    resetPassword: ResetPasswordUseCase;
}
export declare function createAuthRoutes(useCases: AuthUseCases): Hono<AppEnv, import("hono/types").BlankSchema, "/">;
