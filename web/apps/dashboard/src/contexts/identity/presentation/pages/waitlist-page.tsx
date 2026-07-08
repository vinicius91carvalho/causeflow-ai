import { Waitlist } from '@clerk/nextjs';

export default function WaitlistPage() {
  return (
    <main className="flex h-dvh items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
      <Waitlist
        afterJoinWaitlistUrl="https://causeflow.ai?waitlist=joined"
        signInUrl="/auth/sign-in"
      />
    </main>
  );
}
