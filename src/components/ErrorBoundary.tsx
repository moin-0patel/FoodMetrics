import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * App-wide error boundary so a render error shows a recoverable message instead
 * of a blank white screen. Logs the error + component stack to the console.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Render error caught by ErrorBoundary:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="w-full max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              An unexpected error occurred. You can try reloading the page.
            </p>
            <pre className="mt-3 max-h-32 overflow-auto rounded bg-muted p-2 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
            <Button className="mt-4" onClick={() => window.location.reload()}>
              <RotateCcw className="h-4 w-4" /> Reload
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
