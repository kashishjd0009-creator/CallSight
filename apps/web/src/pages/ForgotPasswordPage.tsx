import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

import { AuthShell } from "../components/auth/AuthShell.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";
import { postAuth } from "../lib/auth-api.js";

const forgotSchema = z.object({
  email: z.string().email("Enter a valid email"),
});

type ForgotFormData = z.infer<typeof forgotSchema>;

export function ForgotPasswordPage() {
  const [successMessage, setSuccessMessage] = useState<string>("");
  const [serverError, setServerError] = useState<string>("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormData>({ resolver: zodResolver(forgotSchema) });

  const onSubmit = async (values: ForgotFormData) => {
    try {
      setServerError("");
      setSuccessMessage("");
      await postAuth("/api/v1/auth/forgot-password", values);
      setSuccessMessage("If this email exists, a reset link has been sent.");
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Request failed");
    }
  };

  return (
    <AuthShell
      title="Forgot password"
      subtitle="We will email you reset instructions"
      footer={
        <>
          Remembered your password?{" "}
          <Link className="text-accent-blue hover:underline" to="/login">
            Back to login
          </Link>
        </>
      }
    >
      <form className="space-y-3" onSubmit={handleSubmit(onSubmit)}>
        <Input label="Email" placeholder="you@company.com" type="email" {...register("email")} />
        {errors.email && <p className="text-xs text-accent-red">{errors.email.message}</p>}
        {serverError && <p className="text-xs text-accent-red">{serverError}</p>}
        {successMessage && <p className="text-xs text-accent-green">{successMessage}</p>}
        <div className="pt-1">
          <Button className="w-full justify-center" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Sending..." : "Send reset link"}
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}
