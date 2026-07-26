import { RouterProvider } from "react-router-dom";
import { router } from "./routerConfig";
export function AppRouter() {
  return <RouterProvider router={router} />;
}
