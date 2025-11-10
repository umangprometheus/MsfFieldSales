import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { MapPin, Route, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { loginSchema, type LoginCredentials } from "@shared/schema";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginCredentials>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginCredentials) => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/auth/login", data);
      const userData = await response.json();

      // Invalidate auth cache to trigger re-check
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });

      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
      });

      // Redirect to plan page
      setLocation("/plan");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Login failed",
        description: error.message || "Invalid username or password",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto space-y-8">
        {/* Logo/Brand Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-3">
            <MapPin className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">MSP Field Sales</h1>
          <p className="text-sm text-muted-foreground">Intelligent route planning for field teams</p>
        </div>

        {/* Login Card */}
        <Card className="shadow-lg">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-lg">Sign in to continue</CardTitle>
            <CardDescription>
              Enter your credentials to access your routes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="Enter your username"
                          autoComplete="username"
                          data-testid="input-username"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          type="password"
                          placeholder="Enter your password"
                          autoComplete="current-password"
                          data-testid="input-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-semibold"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
              </form>
            </Form>

            {/* Demo Credentials Hint */}
            <div className="p-3 bg-muted rounded-md">
              <p className="text-xs text-muted-foreground text-center">
                <strong>Demo:</strong> username: <code className="bg-background px-1 py-0.5 rounded">demo</code> / password: <code className="bg-background px-1 py-0.5 rounded">demo123</code>
              </p>
            </div>

            {/* Feature highlights */}
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-start gap-3">
                <Route className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Optimized Routes</p>
                  <p className="text-xs text-muted-foreground">AI-powered stop ordering for efficiency</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Proximity Check-ins</p>
                  <p className="text-xs text-muted-foreground">Auto-detect arrivals within 800 feet</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">HubSpot Sync</p>
                  <p className="text-xs text-muted-foreground">Automatic activity logging to CRM</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
