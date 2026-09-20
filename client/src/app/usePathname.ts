import { useEffect, useState } from "react";

function readLocation(): { path: string; search: string } {
  return {
    path: window.location.pathname || "/",
    search: window.location.search,
  };
}

export function usePathname(): { path: string; search: string; navigate: (to: string) => void } {
  const [location, setLocation] = useState(readLocation);

  useEffect(() => {
    const onPop = () => setLocation(readLocation());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function navigate(to: string) {
    const url = new URL(to, window.location.origin);
    const next = { path: url.pathname || "/", search: url.search };
    if (next.path === location.path && next.search === location.search) {
      return;
    }
    window.history.pushState({}, "", `${next.path}${next.search}`);
    setLocation(next);
  }

  return { path: location.path, search: location.search, navigate };
}
