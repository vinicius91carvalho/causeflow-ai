'use client';

import * as React from 'react';

import { cn } from '../../lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_hsl(var(--background))] [&:-webkit-autofill]:[-webkit-text-fill-color:hsl(var(--foreground))] [&:-webkit-autofill:hover]:shadow-[inset_0_0_0_1000px_hsl(var(--background))] [&:-webkit-autofill:hover]:[-webkit-text-fill-color:hsl(var(--foreground))] [&:-webkit-autofill:focus]:shadow-[inset_0_0_0_1000px_hsl(var(--background))] [&:-webkit-autofill:focus]:[-webkit-text-fill-color:hsl(var(--foreground))] [&:-webkit-autofill:active]:shadow-[inset_0_0_0_1000px_hsl(var(--background))] [&:-webkit-autofill:active]:[-webkit-text-fill-color:hsl(var(--foreground))]',
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';

export { Input };
