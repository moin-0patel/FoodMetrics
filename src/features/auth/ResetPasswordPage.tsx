import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChefHat, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resetPasswordSchema, type ResetPasswordValues } from "@/lib/validation/schemas";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/supabase/authError";
import { toast } from "@/components/ui/use-toast";

/** m***@example.com — never render the full address on this shared screen. */
function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  return `${user.slice(0, 1)}${"*".repeat(Math.max(1, user.length - 1))}@${domain}`;
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const passedEmail = (location.state as { email?: string } | null)?.email ?? "";

  // "otp" = enter the emailed recovery code; "password" = set a new password.
  const [step, setStep] = useState<"otp" | "password">("otp");
  const [email, setEmail] = useState(passedEmail);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [ready, setReady] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // If a recovery session already exists (the user clicked the email LINK rather
  // than entering the code), skip straight to the new-password step.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setStep("password");
      setReady(true);
    });
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const verifyCode = async () => {
    setOtpError(null);
    if (!supabase) {
      setOtpError("Supabase is not configured.");
      return;
    }
    if (!email) {
      setOtpError("Enter the email you requested the code for.");
      return;
    }
    if (otp.trim().length !== 6) {
      setOtpError("Enter the 6-digit code.");
      return;
    }
    setVerifying(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: "recovery",
      });
      if (error) {
        setOtpError(authErrorMessage(error));
        return;
      }
      // verifyOtp established a recovery session → allow setting a new password.
      setStep("password");
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    setOtpError(null);
    if (!supabase || !email) {
      setOtpError("Enter your email first.");
      return;
    }
    setResending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        setOtpError(authErrorMessage(error));
        return;
      }
      toast.success("A new code has been sent.");
      setOtp("");
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : "Could not resend the code");
    } finally {
      setResending(false);
    }
  };

  const onSubmit = async (values: ResetPasswordValues) => {
    setServerError(null);
    if (!supabase) {
      setServerError("Supabase is not configured.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      console.error("Password update failed:", error);
      setServerError(authErrorMessage(error));
      return;
    }
    await supabase.auth.signOut();
    toast.success("Password updated", "Please sign in with your new password.");
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            {step === "otp" ? <ShieldCheck className="h-7 w-7 text-accent" /> : <ChefHat className="h-7 w-7 text-accent" />}
          </div>
          <CardTitle>{step === "otp" ? "Enter your code" : "Set a new password"}</CardTitle>
          <CardDescription>
            {step === "otp" ? (
              email ? (
                <>Enter the 6-digit code we sent to <span className="font-medium text-foreground">{maskEmail(email)}</span>.</>
              ) : (
                "Enter your email and the 6-digit code we sent you."
              )
            ) : (
              "Choose a strong password for your account."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : step === "otp" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void verifyCode();
              }}
              className="space-y-4"
            >
              {!passedEmail && (
                <div className="space-y-1.5">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="reset-otp">Verification code</Label>
                <Input
                  id="reset-otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="text-center text-2xl font-semibold tracking-[0.5em]"
                  autoFocus
                />
                {otpError && <p className="text-xs text-destructive">{otpError}</p>}
              </div>
              <Button type="submit" variant="accent" className="w-full" disabled={verifying}>
                {verifying && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify code
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => void resend()}
                  disabled={resending}
                  className="text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
                >
                  {resending ? "Sending…" : "Resend code"}
                </button>
                <Link to="/forgot-password" className="text-muted-foreground hover:text-foreground hover:underline">
                  Change email
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">New Password</Label>
                <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm Password</Label>
                <Input id="confirm" type="password" autoComplete="new-password" {...register("confirm")} />
                {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
              </div>
              {serverError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</div>
              )}
              <Button type="submit" variant="accent" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Update password
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
