import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { AuthShell } from "../components/auth/AuthShell.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { postAuth } from "../lib/auth-api.js";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/upload";
  const registered = searchParams.get("registered") === "1";
  const [serverError, setServerError] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginFormData) => {
    try {
      setServerError("");
      await postAuth("/api/v1/auth/login", values);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Login failed");
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to access your dashboard"
      footer={
        <>
          New to CallSight?{" "}
          <Link className="text-accent-blue hover:underline" to="/register">
            Create account
          </Link>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
        {registered && (
          <p className="rounded-md border border-accent-blue/40 bg-accent-blue/10 px-3 py-2 text-xs text-text-primary">
            Account created. Sign in with your new credentials.
          </p>
        )}
        <Input label="Email" placeholder="you@company.com" type="email" {...register("email")} />
        {errors.email && <p className="text-xs text-accent-red">{errors.email.message}</p>}

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-text-secondary">Password</span>
          <div className="relative">
            <input
              className="w-full rounded-lg border border-border-base bg-bg-card2 px-3 py-2 pr-10 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent-blue"
              placeholder="••••••••"
              type={showPassword ? "text" : "password"}
              {...register("password")}
            />
            <button
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1 py-1 text-xs text-text-secondary transition-colors hover:text-text-primary"
              onClick={() => setShowPassword((prev) => !prev)}
              type="button"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>
        {errors.password && <p className="text-xs text-accent-red">{errors.password.message}</p>}

        {serverError && <p className="text-xs text-accent-red">{serverError}</p>}
        <div className="flex items-center justify-between pt-1">
          <Link
            className="text-xs text-text-secondary hover:text-text-primary"
            to="/forgot-password"
          >
            Forgot password?
          </Link>
          <Button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
