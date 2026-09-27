'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ShieldAlert } from 'lucide-react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  forgotPasswordSchema, resetPasswordSchema,
  type ForgotPasswordValues, type ResetPasswordValues,
} from '@/lib/validations/auth.schema';
import { Field } from './FormPrimitives';
import { ButtonLink } from '../ui/Primitives';
import { requestPasswordReset, resetPassword as resetPasswordRequest } from '@/lib/api/auth.api';
import { friendlyMessage, ApiError } from '@/lib/api/client';

function BackToSignIn() {
  return <p className="auth-foot"><Link href="/login"><ArrowLeft size={13} style={{ display: 'inline', verticalAlign: 'middle' }} /> Back to Sign In</Link></p>;
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: '' },
  });
  const pending = form.formState.isSubmitting;
  const submit = form.handleSubmit(async values => {
    setError(null);
    try {
      await requestPasswordReset(values.email);
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 503) {
          setError('Unable to send reset email at this time. Please try again later.');
        } else if (err.status === 422) {
          setError('Please enter a valid email address.');
        } else {
          setError(friendlyMessage(err));
        }
      } else {
        setError('Unable to send reset link. Please check your connection and try again.');
      }
    }
  });

  return (
    <>
      <div className="eyebrow">Account Recovery</div>
      <h1>{sent ? 'Check your email' : 'Forgot your password?'}</h1>
      <p role={sent ? 'status' : undefined} aria-live="polite">
        {sent ? 'If an account with that email exists, a password reset link has been sent.' : "Enter the email address associated with your account and we'll send you a secure, time-limited password reset link."}
      </p>
      <FormProvider {...form}>
        <form noValidate onSubmit={submit} aria-busy={pending}>
          {!sent && (
            <Field name="email" label="Email Address" type="email" autoComplete="email" placeholder="you@company.com" required readOnly={pending} />
          )}
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="button" type="submit" disabled={pending}>
            {pending ? 'Sending Reset Link...' : sent ? 'Resend Reset Link' : 'Send Reset Link'}
            {!pending && <ArrowRight size={15} aria-hidden="true" />}
          </button>
          {sent && <p className="small" role="status">{pending ? 'Sending another secure reset link...' : 'Check your inbox and spam folder.'}</p>}
        </form>
      </FormProvider>
      <BackToSignIn />
    </>
  );
}

export function ResetPasswordForm({ token: tokenProp }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [tokenStatus, setTokenStatus] = useState<'valid' | 'invalid' | 'missing'>('valid');
  const token = tokenProp?.trim() || '';

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '', confirmPassword: '' },
  });
  const pending = form.formState.isSubmitting;

  if (!token) return (
    <>
      <div className="eyebrow">Secure Password Reset</div>
      <ShieldAlert size={32} aria-hidden="true" />
      <h1>Missing reset token</h1>
      <p>This password reset link is missing a valid token.</p>
      <ButtonLink href="/forgot-password">Request a new reset link</ButtonLink>
      <BackToSignIn />
    </>
  );

  if (tokenStatus === 'invalid') return (
    <>
      <div className="eyebrow">Secure Password Reset</div>
      <ShieldAlert size={32} aria-hidden="true" />
      <h1>Reset link expired or invalid</h1>
      <p>This password reset link has expired or is invalid.</p>
      <ButtonLink href="/forgot-password">Request a new reset link</ButtonLink>
      <BackToSignIn />
    </>
  );

  const handleSubmit = form.handleSubmit(async values => {
    setError(null);
    try {
      await resetPasswordRequest(token, values.password);
      form.reset();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 400) {
          setError('This reset link is invalid or has expired. Please request a new one.');
          setTokenStatus('invalid');
        } else if (err.status === 403) {
          setError('Your account is not active. Please contact support.');
        } else if (err.status === 503) {
          setError('Service temporarily unavailable. Please try again later.');
        } else if (err.status === 422) {
          setError('Invalid request. Please check your input and try again.');
        } else {
          setError(friendlyMessage(err));
        }
      } else {
        setError('Unable to reset password. Please check your connection and try again.');
      }
    }
  });

  return (
    <>
      <div className="eyebrow">Secure Password Reset</div>
      <h1>Create a new password</h1>
      <p>Choose a new password for your Buildora account.</p>
      <FormProvider {...form}>
        <form noValidate aria-busy={pending} onSubmit={handleSubmit}>
          <Field name="password" label="New Password" type="password" autoComplete="new-password" hint="Must be at least 8 characters." required readOnly={pending} />
          <Field name="confirmPassword" label="Confirm New Password" type="password" autoComplete="new-password" required readOnly={pending} />
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="button" type="submit" disabled={pending}>
            {pending ? 'Resetting Password...' : 'Reset Password'}
            {!pending && <ArrowRight size={15} aria-hidden="true" />}
          </button>
        </form>
      </FormProvider>
      <BackToSignIn />
    </>
  );
}