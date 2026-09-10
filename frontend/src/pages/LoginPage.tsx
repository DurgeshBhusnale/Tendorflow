import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Info, LogIn } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, Label } from "@/components/ui/label";
import { ApiError } from "@/types/api";

// Sign-in is by username (CH-02). No format rule beyond "not empty": a login
// form that rejects a malformed username differently from a wrong one tells an
// attacker which names are worth guessing.
const loginSchema = z.object({
  username: z.string().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});
type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login(values.username, values.password);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong.");
    }
  });

  return (
    <div className="flex min-h-screen">
      {/* Left: editorial panel over the brand artwork. */}
      <div className="login-backdrop hidden flex-1 flex-col justify-between p-12 lg:flex">
        <span className="font-display text-lg font-bold tracking-tight text-white">
          Tender<span className="text-[hsl(var(--primary-light))]">Flow</span>
        </span>
        <div className="max-w-md">
          <p className="font-display text-4xl font-semibold leading-[1.15] tracking-tight text-white">
            Every tender, tracked from notice to award.
          </p>
          <p className="mt-5 text-sm leading-relaxed text-white/70">
            Clients, credentials, DSC keys, and filings in one place.
          </p>
        </div>
        <p className="eyebrow text-white/50">Internal use only</p>
      </div>

      {/* Right: the sign-in card. */}
      <div className="flex flex-1 items-center justify-center bg-background p-4 sm:p-6">
        <form
          onSubmit={onSubmit}
          className="w-full max-w-[400px] border border-border bg-card p-6 shadow-card sm:p-10"
        >
          <h1 className="sr-only">Sign in</h1>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="asha.patil"
                {...register("username")}
              />
              <FieldError>{errors.username?.message}</FieldError>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pr-10"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide the password" : "Show the password"}
                  title={showPassword ? "Hide" : "Show"}
                  className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <FieldError>{errors.password?.message}</FieldError>
            </div>

            {formError && (
              <p className="border border-red-100 bg-red-50 px-3 py-2 text-sm text-destructive">
                {formError}
              </p>
            )}

            <Button
              type="submit"
              variant="ink"
              size="lg"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Signing in…" : "Sign In"}
              <LogIn />
            </Button>
          </div>

          <hr className="my-8 border-border" />

          <div className="flex gap-3">
            <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-xs italic leading-relaxed text-muted-foreground">
              Access is managed by your administrator. Contact IT support if you require credentials
              or assistance.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
