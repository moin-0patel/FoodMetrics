import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChefHat, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signupSchema, type SignupValues } from "@/lib/validation/schemas";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { authErrorMessage } from "@/lib/supabase/authError";
import { onSignIn } from "@/lib/supabase/profile";
import { useSession } from "@/lib/auth/session";
import { isPendingApproval } from "@/lib/auth/permissions";
import { toast } from "@/components/ui/use-toast";

/** Six random digits for the local-dev (mock) OTP simulation. Real accounts use
 *  the code Supabase emails via the confirmation template. */
const genCode = () => String(Math.floor(100000 + Math.random() * 900000));

export function SignUpPage() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "otp">("form");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // OTP step state.
  const [pendingEmail, setPendingEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  // Only used in mock/local-dev mode where no real email is sent.
  const [mockCode, setMockCode] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "", confirm: "" },
  });

  const startOtpStep = (email: string, mock: string | null) => {
    setPendingEmail(email);
    setMockCode(mock);
    setOtp("");
    setOtpError(null);
    setStep("otp");
    if (mock) {
      // Dev-only: surface the simulated code since no email is actually sent.
      toast.success(`Dev OTP for ${email}: ${mock}`);
    }
  };

  const onSubmit = async (values: SignupValues) => {
    setServerError(null);
    const email = values.email.trim().toLowerCase();
    const name = (values.name || "").trim().slice(0, 100);

    // Local-dev / mock mode: simulate sending a 6-digit code to the email.
    if (!isSupabaseConfigured || !supabase) {
      startOtpStep(email, genCode());
      return;
    }

    // Supabase creates the auth user; a DB trigger creates the profile (Viewer,
    // pending approval) and emails a 6-digit confirmation code (OTP). If email
    // confirmation is OFF, a session comes back and we sign the user straight in.
    const { data, error } = await supabase.auth.signUp({
      email,
      password: values.password,
      options: {
        data: { name },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });
    if (error) {
      console.error("Sign-up failed:", error);
      setServerError(authErrorMessage(error));
      return;
    }
    if (data.session) {
      try {
        const user = await onSignIn();
        useSession.getState().setUser(user);
        toast.success(
          isPendingApproval(user)
            ? "Account created — awaiting admin verification."
            : "Account created — welcome!",
        );
        navigate("/dashboard", { replace: true });
      } catch (e) {
        setServerError(e instanceof Error ? e.message : "Sign-up failed");
      }
    } else {
      // Email confirmation is on → move to the OTP entry step.
      startOtpStep(email, null);
    }
  };

  const verifyOtp = async () => {
    setOtpError(null);
    const code = otp.trim();
    if (code.length !== 6) {
      setOtpError("Enter the 6-digit code.");
      return;
    }
    setVerifying(true);
    try {
      // Mock mode: verify against the simulated code, then hand off to sign-in.
      if (!isSupabaseConfigured || !supabase) {
        if (code !== mockCode) {
          setOtpError("Incorrect code. Please try again.");
          return;
        }
        toast.success("Email verified — account created. Please sign in.");
        navigate("/login", { replace: true });
        return;
      }

      const { data, error } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: code,
        type: "signup",
      });
      if (error) {
        setOtpError(authErrorMessage(error));
        return;
      }
      if (data.session) {
        const user = await onSignIn();
        useSession.getState().setUser(user);
        toast.success(
          isPendingApproval(user)
            ? "Email verified — awaiting admin verification."
            : "Email verified — welcome!",
        );
        navigate("/dashboard", { replace: true });
      } else {
        toast.success("Email verified. Please sign in.");
        navigate("/login", { replace: true });
      }
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const resendCode = async () => {
    setOtpError(null);
    setResending(true);
    try {
      if (!isSupabaseConfigured || !supabase) {
        const next = genCode();
        setMockCode(next);
        toast.success(`Dev OTP for ${pendingEmail}: ${next}`);
        return;
      }
      const { error } = await supabase.auth.resend({ type: "signup", email: pendingEmail });
      if (error) {
        setOtpError(authErrorMessage(error));
        return;
      }
      toast.success("A new code is on its way.");
    } catch (e) {
      setOtpError(e instanceof Error ? e.message : "Could not resend the code");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            {step === "otp" ? <ShieldCheck className="h-7 w-7 text-accent" /> : <ChefHat className="h-7 w-7 text-accent" />}
          </div>
          <CardTitle>{step === "otp" ? "Verify your email" : "Create your account"}</CardTitle>
          <CardDescription>
            {step === "otp" ? (
              <>Enter the 6-digit code we sent to <span className="font-medium text-foreground">{pendingEmail}</span>.</>
            ) : (
              "Sign up to start managing recipe costs."
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "otp" ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void verifyOtp();
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="otp">Verification code</Label>
                <Input
                  id="otp"
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
                Verify &amp; continue
              </Button>
              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => void resendCode()}
                  disabled={resending}
                  className="text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
                >
                  {resending ? "Sending…" : "Resend code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep("form");
                    setServerError(null);
                  }}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  Change email
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="username" {...register("email")} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="pr-10"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    className="pr-10"
                    {...register("confirm")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.confirm && <p className="text-xs text-destructive">{errors.confirm.message}</p>}
              </div>
              {serverError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{serverError}</div>
              )}
              <Button type="submit" variant="accent" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Create account
              </Button>
              <Link to="/login" className="block text-center text-xs text-muted-foreground hover:underline">
                Already have an account? Sign in
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
