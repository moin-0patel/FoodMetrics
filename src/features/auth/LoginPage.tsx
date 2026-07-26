import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { loginSchema, type LoginValues } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { usePageMeta } from "@/lib/usePageMeta";
import { AuthBrandPanel } from "./AuthBrandPanel";

/** A post-login destination is only honoured if it's a safe in-app path. */
function safeDestination(path: unknown): string {
  if (typeof path !== "string") return "/dashboard";
  if (!path.startsWith("/") || path.startsWith("//")) return "/dashboard";
  if (/^\/(login|signup|forgot-password|reset-password)\b/.test(path)) return "/dashboard";
  return path;
}

export function LoginPage() {
  usePageMeta({ title: "Sign in · Food Metrics", noindex: true });
  const user = useSession((s) => s.user);
  const login = useSession((s) => s.login);
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const dest = safeDestination((location.state as { from?: { pathname?: string } } | null)?.from?.pathname);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Already signed in? Skip the form and go straight to the intended page.
  if (user) return <Navigate to={dest} replace />;

  const onSubmit = async (values: LoginValues) => {
    setServerError(null);
    try {
      await login(values.email, values.password);
      navigate(dest, { replace: true });
    } catch (e) {
      setServerError(e instanceof Error ? e.message : "Unable to sign in right now. Please try again.");
    }
  };

  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-2">
      <AuthBrandPanel />

      {/* Right: the login card. Full width on mobile/tablet, right column on desktop. */}
      <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          {/* Compact logo — the primary brand cue on small screens where the panel is hidden. */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo size="lg" withSubtitle />
          </div>

          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">Welcome back</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to your Food Metrics account to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoFocus
                placeholder="you@company.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email")}
              />
              {errors.email && (
                <p id="email-error" className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="pr-10"
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "password-error" : undefined}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            {serverError && (
              <div
                role="alert"
                className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {serverError}
              </div>
            )}

            <Button type="submit" className="h-10 w-full text-sm" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          {/* Supabase mode: offer account creation. */}
          {isSupabaseConfigured && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link to="/signup" className="font-medium text-primary hover:underline">
                Request access
              </Link>
            </p>
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Authorized users only.
          </p>
          {/* Name only here — the full credit with contact lives in the public footer. */}
          <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
            Developed by Moin Patel
          </p>
        </div>
      </main>
    </div>
  );
}
