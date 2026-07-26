import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { resetDb } from "@/lib/data/mock/db";
import { useSession } from "@/lib/auth/session";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { User } from "@/lib/data/types";
import { UserEditorPage } from "./UserEditorPage";

// Proves Create User is a full PAGE (like the Recipe / Raw Material editors), not a modal.

const admin = { id: "u-admin", name: "Admin", email: "a@b.co", role: "admin", status: "active" } as unknown as User;

describe("UserEditorPage — full-page Create User", () => {
  beforeEach(() => {
    resetDb();
    useSession.setState({ user: admin });
  });

  it("renders as a page with a Back button, account fields, and access scope", async () => {
    // No :id param → create ("Create User") mode.
    renderWithProviders(<UserEditorPage />);

    expect(await screen.findByRole("heading", { name: "Create User" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
    expect(screen.getByText("Email *")).toBeInTheDocument();
    expect(screen.getByText(/Temporary Password/i)).toBeInTheDocument();
    expect(screen.getByText("Brand & Outlet Access")).toBeInTheDocument();
  });
});
