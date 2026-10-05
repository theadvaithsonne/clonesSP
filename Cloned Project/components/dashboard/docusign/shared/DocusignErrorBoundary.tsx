"use client";

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// React error boundaries can't be function components/hooks — this must stay a class.
// There is no error boundary anywhere else in this app (confirmed: no app/**/error.tsx,
// no other <ErrorBoundary>), so without this, a render-time crash anywhere in Docusign
// unmounts the entire dashboard shell, not just this tab.
export class DocusignErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Docusign] render error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-amber-400" />
          <h2 className="text-sm font-semibold text-white/90">Something went wrong in Docusign</h2>
          <p className="max-w-sm text-xs text-[#7a7a90]">{this.state.error.message || "An unexpected error occurred."}</p>
          <Button size="sm" variant="outline" onClick={() => this.setState({ error: null })}>
            Try again
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
