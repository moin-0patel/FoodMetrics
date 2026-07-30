import { Link } from "react-router-dom";
import { Logo } from "@/components/brand/Logo";

// Multi-column footer. Deliberately only links to destinations that exist —
// there are no Careers / Pricing / Case Studies / Privacy pages in this app, so
// listing them would ship dead links. The "Platform" and "Operations" columns are
// capability labels, not links.

const PLATFORM = ["Recipe costing", "In-house prep", "Yield management", "Packaging costs"];
const OPERATIONS = ["Wastage tracking", "Approvals workflow", "Brand & outlet reporting", "PDF & Excel export"];

export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto max-w-[1728px] px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="max-w-xs">
            <Logo size="md" withSubtitle />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Recipe costing, yield and wastage management for multi-brand kitchens.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Platform</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {PLATFORM.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Operations</p>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {OPERATIONS.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Access</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a href="#overview" className="text-muted-foreground hover:text-foreground">Overview</a>
              </li>
              <li>
                <a href="#features" className="text-muted-foreground hover:text-foreground">Features</a>
              </li>
              <li>
                <a href="#how-it-works" className="text-muted-foreground hover:text-foreground">Platform</a>
              </li>
              <li>
                <Link to="/login" className="text-muted-foreground hover:text-foreground">Sign In</Link>
              </li>
              <li>
                <Link to="/signup" className="text-muted-foreground hover:text-foreground">Request Access</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Photo attribution. The demo photography is Wikimedia Commons material,
            most of it CC BY-SA — which obliges us to credit the authors wherever the
            images are published. This link is that credit; don't drop it unless the
            photos are replaced with your own. CREDITS.md is served from public/. */}
        <p className="mt-10 text-xs text-muted-foreground">
          Photography from Wikimedia Commons under Creative Commons and public-domain
          licences —{" "}
          <a
            href="/demo/photos/CREDITS.md"
            className="underline decoration-dotted underline-offset-2 hover:text-foreground"
          >
            image credits
          </a>
          .
        </p>

        <div className="mt-4 flex flex-col gap-2 border-t pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Food Metrics. All rights reserved.</p>
          {/* Developer credit. The email is intentionally public here. */}
          <p>
            Developed by <span className="font-medium text-foreground">Moin Patel</span>
            {" — "}
            <a
              href="mailto:mspatel05831@gmail.com"
              className="underline decoration-dotted underline-offset-2 hover:text-foreground"
            >
              mspatel05831@gmail.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
