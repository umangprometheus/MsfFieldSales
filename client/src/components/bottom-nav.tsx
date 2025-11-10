import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { MapIcon, Route, History, User } from "lucide-react";

const allNavItems = [
  { path: "/plan", label: "Plan", icon: MapIcon },
  { path: "/route", label: "Route", icon: Route },
  { path: "/history", label: "History", icon: History },
  { path: "/summary", label: "Summary", icon: User },
];

export default function BottomNav() {
  const [location] = useLocation();
  const [hasActiveRoute, setHasActiveRoute] = useState(false);

  // Check if there's an active route
  useEffect(() => {
    const checkActiveRoute = () => {
      const activeRoute = localStorage.getItem("activeRoute");
      setHasActiveRoute(!!activeRoute);
    };

    // Check on mount
    checkActiveRoute();

    // Listen for storage changes (when route is created/ended)
    window.addEventListener("storage", checkActiveRoute);
    
    // Also check periodically as localStorage events don't fire in same tab
    const interval = setInterval(checkActiveRoute, 1000);

    return () => {
      window.removeEventListener("storage", checkActiveRoute);
      clearInterval(interval);
    };
  }, []);

  // Filter nav items based on active route
  const navItems = allNavItems.filter(
    (item) => item.path !== "/route" || hasActiveRoute
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t z-40 pb-safe md:hidden">
      <div className="flex items-stretch justify-around px-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path;

          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={`flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-md transition-colors flex-1 min-h-[64px] ${
                isActive
                  ? "text-primary bg-primary/5"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-xs font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
