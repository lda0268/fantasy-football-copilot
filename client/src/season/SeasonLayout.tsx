import type { ReactNode } from "react";
import { NAV_ITEMS } from "../app/routes";

type SeasonLayoutProps = {
  path: string;
  navigate: (to: string) => void;
  children: ReactNode;
};

export function SeasonLayout({ path, navigate, children }: SeasonLayoutProps) {
  return (
    <div className="season-app">
      <a className="skip-link" href="#season-main">
        Skip to content
      </a>
      <aside className="season-sidebar" aria-label="Primary">
        <div className="season-brand">
          <p className="season-brand-kicker">Fantasy Football</p>
          <p className="season-brand-name">Co-Pilot</p>
        </div>
        <nav className="season-nav">
          {NAV_ITEMS.map((item) => {
            const active = path === item.path;
            return (
              <a
                key={item.path}
                href={item.path}
                className={active ? "season-nav-link is-active" : "season-nav-link"}
                aria-current={active ? "page" : undefined}
                onClick={(event) => {
                  event.preventDefault();
                  navigate(item.path);
                }}
              >
                {item.label}
              </a>
            );
          })}
        </nav>
      </aside>
      <div className="season-shell">
        <main id="season-main" className="season-main">
          {children}
        </main>
      </div>
    </div>
  );
}
