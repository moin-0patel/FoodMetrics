import { useNavigate } from "react-router-dom";
import { KeyRound, LogOut, UserCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth/session";
import { type User } from "@/lib/data/types";
import { roleLabel } from "@/lib/auth/roleCache";
import { allBrandIds, brandLabel } from "@/lib/data/brandCache";

/** Initials fallback for users without an avatar. */
function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function Avatar({ user, className }: { user: User; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary",
        className,
      )}
    >
      {user.avatar_url ? (
        <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
      ) : (
        initials(user.name)
      )}
    </span>
  );
}

/** "Branch" line on the profile menu — maps to the app's brand concept. */
function branchLabel(user: User): string | null {
  if (user.role === "viewer") {
    const ids = user.accessible_brands ?? allBrandIds();
    return ids.map(brandLabel).join(", ");
  }
  return null;
}

export function ProfileMenu() {
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);
  if (!user) return null;
  const branch = branchLabel(user);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          aria-label="Open profile menu"
        >
          <Avatar user={user} />
          <span className="hidden text-sm font-medium sm:block">{user.name.split(" ")[0]}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar user={user} className="h-10 w-10 text-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-2 pb-2">
          <Badge variant="outline">{roleLabel(user.role)}</Badge>
          {branch && <span className="truncate text-xs text-muted-foreground">{branch}</span>}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/profile")}>
          <UserCircle className="h-4 w-4" /> Edit Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate("/profile?tab=password")}>
          <KeyRound className="h-4 w-4" /> Change Password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10">
          <LogOut className="h-4 w-4" /> Logout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
