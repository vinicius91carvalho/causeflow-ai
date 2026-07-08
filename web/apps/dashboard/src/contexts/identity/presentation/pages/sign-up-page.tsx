import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="flex items-center justify-center">
      <SignUp
        fallbackRedirectUrl="/create-organization"
        signInUrl="/auth/sign-in"
        waitlistUrl="/waitlist"
        appearance={{
          elements: {
            formFieldInput: {
              autoComplete: 'off',
            },
          },
        }}
      />
    </div>
  );
}
