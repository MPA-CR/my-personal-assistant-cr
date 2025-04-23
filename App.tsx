import { Switch, Route, Link, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import AuthPage from "@/pages/auth-page";
import Bookings from "@/pages/bookings";
import Messages from "@/pages/messages";
import Profile from "@/pages/profile";
import AdminIndex from "@/pages/admin/index";
import AdminAssistants from "@/pages/admin/assistants";
import AdminBookings from "@/pages/admin/bookings";
import AdminServices from "@/pages/admin/services";
import SplashScreen from "@/components/common/SplashScreen";
import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

// Protected route component that requires authentication
function ProtectedRoute({ component: Component, admin = false, ...rest }: { 
  component: React.ComponentType<any>, 
  path: string,
  admin?: boolean 
}) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/auth");
    } else if (!isLoading && admin && user?.role !== 'admin') {
      navigate("/"); // Regular users can't access admin routes
    }
  }, [user, isLoading, navigate, admin]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return user ? <Component {...rest} /> : null;
}

// Login/Register route that redirects to home if already logged in
function AuthRoute({ component: Component, ...rest }: { 
  component: React.ComponentType<any>,
  path: string
}) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    // Redirect to home if already logged in
    if (!isLoading && user) {
      navigate("/");
    }
  }, [user, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return !user ? <Component {...rest} /> : null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      
      {/* Auth routes */}
      <Route path="/auth">
        <AuthRoute component={AuthPage} path="/auth" />
      </Route>
      
      {/* Protected routes */}
      <Route path="/bookings">
        <ProtectedRoute component={Bookings} path="/bookings" />
      </Route>
      
      <Route path="/messages">
        <ProtectedRoute component={Messages} path="/messages" />
      </Route>
      
      <Route path="/profile">
        <ProtectedRoute component={Profile} path="/profile" />
      </Route>
      
      {/* Admin routes */}
      <Route path="/admin">
        <ProtectedRoute component={AdminIndex} path="/admin" admin={true} />
      </Route>
      
      <Route path="/admin/assistants">
        <ProtectedRoute component={AdminAssistants} path="/admin/assistants" admin={true} />
      </Route>
      
      <Route path="/admin/bookings">
        <ProtectedRoute component={AdminBookings} path="/admin/bookings" admin={true} />
      </Route>
      
      <Route path="/admin/services">
        <ProtectedRoute component={AdminServices} path="/admin/services" admin={true} />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          {showSplash ? <SplashScreen /> : <Router />}
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
