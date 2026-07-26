import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { resetDb } from "@/lib/data/mock/db";
import { useSession } from "@/lib/auth/session";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { User } from "@/lib/data/types";
import { ProfilePage } from "./ProfilePage";

// Proves /settings → Profile Settings: the page a user manages their own account
// from (was the global cost-config Settings page).

const mockUser = {
  id: "u-test",
  name: "Test User",
  email: "test@example.com",
  phone: null,
  avatar_url: null,
  role: "super_admin",
  status: "active",
  last_login: null,
  created_at: "2026-01-01T00:00:00.000Z",
} as unknown as User;

describe("ProfilePage — is the Profile Settings screen", () => {
  beforeEach(() => {
    resetDb();
    useSession.setState({ user: mockUser });
  });

  it("shows the Profile Settings heading and the account fields", async () => {
    renderWithProviders(<ProfilePage />);

    expect(await screen.findByText("Profile Settings")).toBeInTheDocument();
    expect(screen.getByText("Full Name")).toBeInTheDocument();
    expect(screen.getAllByText("test@example.com").length).toBeGreaterThanOrEqual(1);
    // Password management lives here too.
    expect(screen.getByText("Password")).toBeInTheDocument();
    // It is NOT the old global cost-config page.
    expect(screen.queryByText(/Food Cost Configuration/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Margin Alert/i)).not.toBeInTheDocument();
  });
});
