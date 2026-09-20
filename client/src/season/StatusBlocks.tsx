type StatusBlockProps = {
  title?: string;
  message: string;
  detail?: string;
};

export function LoadingState({ message = "Loading dashboard…" }: { message?: string }) {
  return (
    <div className="status-card" role="status">
      {message}
    </div>
  );
}

export function EmptyState({ title, message }: StatusBlockProps) {
  return (
    <div className="status-card">
      {title ? <h3>{title}</h3> : null}
      <p>{message}</p>
    </div>
  );
}

export function ProviderErrorState({ title = "Data unavailable", message, detail }: StatusBlockProps) {
  return (
    <div className="status-card is-error" role="alert">
      <h3>{title}</h3>
      <p>{message}</p>
      {detail && import.meta.env.DEV ? <p className="dev-detail">{detail}</p> : null}
    </div>
  );
}
