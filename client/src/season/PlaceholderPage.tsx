import { ROUTES } from "../app/routes";

type PlaceholderPageProps = {
  title: string;
  navigate: (to: string) => void;
};

export function PlaceholderPage({ title, navigate }: PlaceholderPageProps) {
  return (
    <section className="panel-card placeholder-page" data-testid="placeholder-page">
      <h1>{title}</h1>
      <p>This feature is not implemented yet.</p>
      <a
        href={ROUTES.dashboard}
        onClick={(event) => {
          event.preventDefault();
          navigate(ROUTES.dashboard);
        }}
      >
        Back to Dashboard
      </a>
    </section>
  );
}
