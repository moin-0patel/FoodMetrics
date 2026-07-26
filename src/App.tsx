import { useEffect } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { AppRouter } from "./router";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "./components/ui/toaster";
import { IosInstallPrompt } from "./features/pwa/IosInstallPrompt";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { applyTheme, useTheme } from "./lib/theme";

export default function App() {
  const theme = useTheme((s) => s.theme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AppRouter />
        <Toaster />
        <IosInstallPrompt />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
