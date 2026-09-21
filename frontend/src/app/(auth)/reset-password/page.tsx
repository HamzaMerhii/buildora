import { ResetPasswordForm } from '@/components/forms/PasswordRecoveryForms';

export default async function Page({ searchParams }: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const resetToken = typeof token === 'string' ? token.trim() : '';
  return <ResetPasswordForm key={resetToken} token={resetToken} />;
}
