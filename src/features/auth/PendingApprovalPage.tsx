import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/lib/auth/session";
import { usersRepo } from "@/lib/data";
import { isPendingApproval } from "@/lib/auth/permissions";
import { toast } from "@/components/ui/use-toast";

/**
 * Shown to a signed-in user whose self sign-up an admin hasn't verified yet.
 * They can re-check their status or sign out, but cannot enter the app.
 */
export function PendingApprovalPage() {
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const logout = useSession((s) => s.logout);
  const [checking, setChecking] = useState(false);

  const recheck = async () => {
    if (!user) return;
    setChecking(true);
    try {
      const fresh = await usersRepo.getById(user.id);
      if (fresh && !isPendingApproval(fresh)) {
        setUser(fresh);
        toast.success("You're verified — welcome!");
        navigate("/dashboard", { replace: true });
      } else {
        toast.info("Still awaiting admin approval.");
      }
    } finally {
      setChecking(false);
    }
  };

  const signOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <Clock className="h-7 w-7 text-amber-500" />
          </div>
          <CardTitle>Verification Pending</CardTitle>
          <CardDescription>
            Your account{user?.email ? ` (${user.email})` : ""} has been created and is awaiting
            administrator approval. You'll get access as soon as an admin verifies you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button onClick={recheck} variant="accent" className="w-full" disabled={checking}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Check status
          </Button>
          <Button onClick={signOut} variant="outline" className="w-full">
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
