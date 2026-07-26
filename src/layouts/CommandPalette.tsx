import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { navGroupsForRole } from "./nav";
import type { Role } from "@/lib/data/types";

/**
 * Cmd/Ctrl-K menu search. Opened from anywhere via the keyboard shortcut or by
 * passing `open`/`onOpenChange`. Lists the role's nav items grouped by section.
 */
export function CommandPalette({
  role,
  open,
  onOpenChange,
}: {
  role: Role;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const groups = navGroupsForRole(role);

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
        <Command>
          <CommandInput placeholder="Search menu…" />
          <CommandList>
            <CommandEmpty>No matching page.</CommandEmpty>
            {groups.map(({ group, items }) => (
              <CommandGroup key={group} heading={group}>
                {items.map((item) => (
                  <CommandItem key={item.to} value={`${group} ${item.label}`} onSelect={() => go(item.to)}>
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/** Global Cmd/Ctrl-K listener that flips a boolean. */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  return { open, setOpen };
}
