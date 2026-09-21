"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signInSchema, registerSchema } from "@/lib/validations/auth.schema";
import { Field, CheckField } from "./FormPrimitives";
import { useWorkspace } from "../features/WorkspaceProvider";
import { useAuthStore } from "@/stores/auth.store";
import { getPostLoginRoute } from "@/lib/auth/redirect";
import { loginUser, registerUser } from "@/lib/api/auth.api";
import { ApiError, friendlyMessage } from "@/lib/api/client";

function BackendError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="field-error" role="alert">
      {message}
    </p>
  );
}

export function SignInForm() {
  const router = useRouter();
  const { notify } = useWorkspace();
  const login = useAuthStore((s) => s.login);
  const fetchSession = useAuthStore((s) => s.fetchSession);
  const logout = useAuthStore((s) => s.logout);
  const [backendError, setBackendError] = useState<string | null>(null);
  const [resolvingRole, setResolvingRole] = useState(false);
  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "", remember: false },
  });
  const pending = form.formState.isSubmitting;
  const busy = pending || resolvingRole;
  return (
    <>
      <div className="eyebrow">Workspace Access</div>
      <h1>Welcome back</h1>
      <p>Sign in to continue to your workspace.</p>
      <FormProvider {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit(async (v) => {
            setBackendError(null);
            try {
              const result = await loginUser(v.email, v.password);
              login(result.access_token);
              // Role routing needs the session context; never redirect
              // on the token alone.
              setResolvingRole(true);
              try {
                const ctx = await fetchSession();
                notify("Signed in successfully.");
                router.push(
                  getPostLoginRoute(
                    ctx.platform_role,
                    ctx.memberships[0]?.role ?? null,
                  ),
                );
              } catch (sessionError) {
                if (
                  sessionError instanceof ApiError &&
                  sessionError.status === 401
                ) {
                  logout();
                  setBackendError(
                    "Session expired. Please sign in again.",
                  );
                } else {
                  setBackendError(friendlyMessage(sessionError));
                }
              } finally {
                setResolvingRole(false);
              }
            } catch (error) {
              if (error instanceof ApiError && error.fields) {
                for (const [field, messages] of Object.entries(error.fields)) {
                  if (field in v)
                    form.setError(field as keyof typeof v, {
                      message: messages[0],
                    });
                }
              }
              setBackendError(friendlyMessage(error));
            }
          })}
        >
          <Field
            name="email"
            label="Email Address *"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
          />
          <Field
            name="password"
            label="Password *"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
          />
          <Link
            className="text-link"
            style={{ alignSelf: "flex-end", marginTop: -12 }}
            href="/forgot-password"
          >
            Forgot password?
          </Link>
          <CheckField
            name="remember"
            label="Keep me signed in on this workstation"
          />
          <BackendError message={backendError} />
          <button className="button" type="submit" disabled={busy}>
            {resolvingRole
              ? "Loading workspace…"
              : pending
                ? "Signing In…"
                : "Sign In →"}
          </button>
        </form>
      </FormProvider>
      <p className="auth-foot">
        Don’t have an account? <Link href="/register">Create account</Link>
      </p>
    </>
  );
}
export function RegisterForm() {
  const router = useRouter();
  const { update, notify } = useWorkspace();
  const login = useAuthStore((s) => s.login);
  const [backendError, setBackendError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      password: "",
      confirmPassword: "",
      terms: false,
    },
  });
  const pending = form.formState.isSubmitting;
  return (
    <>
      <div className="eyebrow">Step 1 of 3 · Account Creation</div>
      <h1>Create your account</h1>
      <p>Start by creating your personal account.</p>
      <FormProvider {...form}>
        <form
          noValidate
          onSubmit={form.handleSubmit(async (v) => {
            setBackendError(null);
            try {
              await registerUser({
                name: v.name,
                email: v.email,
                phone: v.phone,
                password: v.password,
              });
              const session = await loginUser(v.email, v.password);
              login(session.access_token);
              update({
                profile: { name: v.name, email: v.email, phone: v.phone },
              });
              notify("Account created. Set up your company workspace.");
              router.push("/company-setup");
            } catch (error) {
              if (error instanceof ApiError && error.fields) {
                for (const [field, messages] of Object.entries(error.fields)) {
                  if (field in v)
                    form.setError(field as keyof typeof v, {
                      message: messages[0],
                    });
                }
              }
              setBackendError(friendlyMessage(error));
            }
          })}
        >
          <Field name="name" label="Full Name *" autoComplete="name" />
          <Field
            name="email"
            label="Work Email *"
            type="email"
            autoComplete="email"
          />
          <Field
            name="phone"
            label="Phone Number *"
            type="tel"
            autoComplete="tel"
            placeholder="+96170123456"
            hint="Digits only, optional leading +, 8–15 characters."
          />
          <Field
            name="password"
            label="Password *"
            type="password"
            autoComplete="new-password"
            hint="Use at least 8 characters."
          />
          <Field
            name="confirmPassword"
            label="Confirm Password *"
            type="password"
            autoComplete="new-password"
          />
          <CheckField
            name="terms"
            label="I accept the workspace terms of service and privacy standards."
          />
          <BackendError message={backendError} />
          <button className="button" type="submit" disabled={pending}>
            {pending ? "Creating Account…" : "Create Account →"}
          </button>
        </form>
      </FormProvider>
      <p className="auth-foot">
        Already have an account? <Link href="/sign-in">Sign in</Link>
      </p>
    </>
  );
}
