'use server';

import { setStagingAuthCookie } from '@causeflow/shared/infrastructure/middleware/staging-auth';
import { redirect } from 'next/navigation';

export async function authenticateStaging(
  _prevState: { error: string } | null,
  formData: FormData,
): Promise<{ error: string }> {
  const username = formData.get('username');
  const password = formData.get('password');

  const stagingPassword = process.env.NEXT_PUBLIC_STAGING_PASSWORD;

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username !== 'causeflow' ||
    !stagingPassword ||
    password !== stagingPassword
  ) {
    return { error: 'Invalid credentials' };
  }

  await setStagingAuthCookie(password);

  redirect('/');
}
