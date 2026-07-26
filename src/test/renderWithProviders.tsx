import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { ReactElement } from "react";

/** Render a component tree with the TanStack Query provider (mock repos run
 *  against localStorage in jsdom) and a data router. The data router matches the
 *  app (App.tsx uses RouterProvider) so navigation-aware hooks like useBlocker —
 *  used by the shared unsaved-changes protection — work in tests. Retries are off
 *  so failures surface fast. */
export function renderWithProviders(ui: ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: "/", element: ui }], { initialEntries: ["/"] });
  return render(
    <QueryClientProvider client={qc}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
