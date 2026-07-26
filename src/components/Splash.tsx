/**
 * Boot/flash screen shown (in the installed app) while the initial auth check
 * resolves, then the root routes to login/dashboard. Renders the full Food Metrics
 * logo on the dark brand background — identical to the static #cc-boot splash in
 * index.html, so the hand-off from first-paint to React is seamless (one logo, no
 * white flash).
 */
export function Splash() {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "#010c12" }}
    >
      <img src="/brand/logo.png" alt="Food Metrics" className="w-[380px] max-w-[82vw]" />
    </div>
  );
}
