import React, { Component, ErrorInfo, ReactNode } from "react";
import * as Sentry from "@sentry/react";
import { AlertTriangle, RefreshCw, Bug, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
  copied: boolean;
}

// Generate a unique error ID for support reference
function generateErrorId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ERR-${timestamp}-${random}`.toUpperCase();
}

// Log error to console with structured format for monitoring
function logErrorToMonitoring(error: Error, errorInfo: ErrorInfo, errorId: string) {
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    // Verbose logging in development
    const errorLog = {
      errorId,
      timestamp: new Date().toISOString(),
      message: error.message,
      name: error.name,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
    };
    console.error("[ErrorBoundary] Application Error:", JSON.stringify(errorLog, null, 2));
  } else {
    // Minimal logging in production - no stack traces or sensitive info
    console.error("[ErrorBoundary] Application Error:", {
      errorId,
      timestamp: new Date().toISOString(),
      message: error.message,
      name: error.name,
    });
  }
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, errorId: generateErrorId() };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Report to Sentry (if initialized)
    const sentryEventId = Sentry.captureException(error, {
      contexts: {
        react: { componentStack: errorInfo.componentStack },
      },
    });

    // Use Sentry event ID if available, otherwise keep the generated one
    if (sentryEventId) {
      this.setState({ errorId: sentryEventId });
    }

    // Log to console
    if (this.state.errorId) {
      logErrorToMonitoring(error, errorInfo, this.state.errorId);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      copied: false,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleCopyErrorId = async () => {
    if (this.state.errorId) {
      try {
        await navigator.clipboard.writeText(this.state.errorId);
        this.setState({ copied: true });
        setTimeout(() => this.setState({ copied: false }), 2000);
      } catch {
        // Fallback for older browsers
        console.log("Error ID:", this.state.errorId);
      }
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDev = process.env.NODE_ENV === "development";

      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error occurred. Please try again or refresh the page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error ID for support reference */}
              {this.state.errorId && (
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Bug className="h-3 w-3" />
                  <span>Error ID: {this.state.errorId}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={this.handleCopyErrorId}
                  >
                    {this.state.copied ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              )}

              {/* Developer-only error details */}
              {isDev && this.state.error && (
                <details className="text-xs bg-muted p-3 rounded-md">
                  <summary className="cursor-pointer font-medium mb-2">
                    Error details (dev only)
                  </summary>
                  <pre className="whitespace-pre-wrap break-words text-destructive">
                    {this.state.error.message}
                  </pre>
                  {this.state.error.stack && (
                    <pre className="whitespace-pre-wrap break-words text-muted-foreground mt-2 text-[10px]">
                      {this.state.error.stack}
                    </pre>
                  )}
                  {this.state.errorInfo && (
                    <pre className="whitespace-pre-wrap break-words text-muted-foreground mt-2 text-[10px]">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </details>
              )}

              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={this.handleRetry}>
                  Try Again
                </Button>
                <Button onClick={this.handleReload}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reload Page
                </Button>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                If this problem persists, please contact support with the error ID above.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
