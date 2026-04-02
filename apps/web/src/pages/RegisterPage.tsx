import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { AuthShell } from "../components/auth/AuthShell.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { postAuth } from "../lib/auth-api.js";

const registerSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Enter a valid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string>("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (values: RegisterFormData) => {
    try {
      setServerError("");
      await postAuth("/api/v1/auth/register", {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
      });
      navigate("/login?registered=1", { replace: true });
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Registration failed");
    }
  };

  return (
    <AuthShell
      title="Create account"
      subtitle="Start analyzing call center performance"
      footer={
        <>
          Already have an account?{" "}
          <Link className="text-accent-blue hover:underline" to="/login">
            Sign in
          </Link>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Input label="First name" placeholder="Jane" {...register("firstName")} />
            {errors.firstName && (
              <p className="mt-1 text-xs text-accent-red">{errors.firstName.message}</p>
            )}
          </div>
          <div>
            <Input label="Last name" placeholder="Doe" {...register("lastName")} />
            {errors.lastName && (
              <p className="mt-1 text-xs text-accent-red">{errors.lastName.message}</p>
            )}
          </div>
        </div>

        <Input label="Email" placeholder="you@company.com" type="email" {...register("email")} />
        {errors.email && <p className="text-xs text-accent-red">{errors.email.message}</p>}

        <Input
          label="Password"
          placeholder="At least 8 characters"
          type="password"
          {...register("password")}
        />
        {errors.password && <p className="text-xs text-accent-red">{errors.password.message}</p>}

        <Input
          label="Confirm password"
          placeholder="Re-enter password"
          type="password"
          {...register("confirmPassword")}
        />
        {errors.confirmPassword && (
          <p className="text-xs text-accent-red">{errors.confirmPassword.message}</p>
        )}

        {serverError && <p className="text-xs text-accent-red">{serverError}</p>}
        <div className="pt-1">
          <Button className="w-full justify-center" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Creating account..." : "Create account"}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
