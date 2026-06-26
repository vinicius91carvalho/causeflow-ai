'use client';

import { CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AnimatedRedirectProps {
  to: string;
  delay?: number;
  message: string;
  onMount?: () => void;
}

export function AnimatedRedirect({ to, delay = 2000, message, onMount }: AnimatedRedirectProps) {
  const router = useRouter();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    onMount?.();
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 100 / (delay / 50);
      });
    }, 50);
    const timer = setTimeout(() => router.push(to), delay);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [to, delay, router, onMount]);

  return (
    <div className="flex flex-col items-center gap-4 animate-in fade-in duration-500">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-success/50/10">
        <CheckCircle2 className="h-8 w-8 text-success" />
      </div>
      <p className="text-center text-lg font-medium">{message}</p>
      <div className="h-1 w-48 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-100 ease-linear rounded-full"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
