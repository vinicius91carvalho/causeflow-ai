import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="flex items-center justify-center">
      <SignIn fallbackRedirectUrl="/dashboard" signUpUrl="/auth/sign-up" waitlistUrl="/waitlist" />
    </div>
  );
}
