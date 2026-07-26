import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChefHat, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/lib/validation/schemas";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/supabase/authError";

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotPasswordValues) => {
    setServerError(null);
    const email = values.email.trim().toLowerCase();
    if (!isSupabaseConfigured || !supabase) {
      setServerError("Password reset is not configured. Contact your admin.");
      return;
    }
    // Sends the recovery email. With the "Reset Password" template exposing
    // {{ .Token }}, the email contains a 6-digit OTP the user enters on the next
    // screen (redirectTo keeps the click-through link working as a fallback).
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    // Do not reveal whether the account exists — proceed to the code screen either
    // way, unless the request itself failed (config/network), which we surface.
    if (error) {
      console.error("Password reset failed:", error);
      setServerError(authErrorMessage(error));
      return;
    }
    navigate("/reset-password", { state: { email }, replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <ChefHat className="h-7 w-7 text-accent" />
          </div>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>Enter your email and we'll send you a verification code.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            {serverError && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</div>
            )}
            <Button type="submit" variant="accent" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Send code
            </Button>
            <Link to="/login" className="block text-center text-xs text-muted-foreground hover:underline">
              Back to sign in
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
