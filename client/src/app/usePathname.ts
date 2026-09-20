import { useEffect, useState } from "react";

export function usePathname(): { path: string; navigate: (to: string) => void } {
  const [path, setPath] = useState(() => window.location.pathname || "/");

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname || "/");
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function navigate(to: string) {
    if (to === path) {
      return;
    }
    window.history.pushState({}, "", to);
    setPath(to);
  }

  return { path, navigate };
}
