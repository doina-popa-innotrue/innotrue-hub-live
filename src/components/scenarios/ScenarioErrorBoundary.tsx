import { Component, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface Props {
  children: ReactNode;
  fallbackPath?: string;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ScenarioErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ScenarioErrorBoundary caught error:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      const { fallbackPath = "/scenarios", fallbackLabel = "Back to Scenarios" } = this.props;

      return (
        <div className="container py-12">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <CardTitle>Something went wrong</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-muted-foreground">
                We encountered an error while loading this scenario. Please try again.
              </p>
              {this.state.error?.message && (
                <p className="text-xs text-muted-foreground bg-muted p-2 rounded font-mono">
                  {this.state.error.message}
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Button onClick={this.handleRetry} variant="default">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button asChild variant="outline">
                  <Link to={fallbackPath}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {fallbackLabel}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
