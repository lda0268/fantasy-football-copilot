import { DraftRoom } from "./components/DraftRoom";
import { ROUTES } from "./app/routes";
import { usePathname } from "./app/usePathname";
import { DashboardPage } from "./season/DashboardPage";
import { MyTeamPage } from "./season/MyTeamPage";
import { PlaceholderPage } from "./season/PlaceholderPage";
import { SeasonLayout } from "./season/SeasonLayout";
import { WaiverWirePage } from "./season/WaiverWirePage";
import "./styles/draft.css";
import "./styles/season.css";

const PLACEHOLDERS: Record<string, string> = {
  [ROUTES.startSit]: "Start / Sit",
  [ROUTES.players]: "Players",
  [ROUTES.league]: "League",
  [ROUTES.settings]: "Settings",
};

export default function App() {
  const { path, navigate } = usePathname();

  if (path === ROUTES.draft) {
    return <DraftRoom />;
  }

  const placeholder = PLACEHOLDERS[path];
  return (
    <SeasonLayout path={path === "/" ? ROUTES.dashboard : path} navigate={navigate}>
      {path === ROUTES.dashboard ? (
        <DashboardPage navigate={navigate} />
      ) : path === ROUTES.waivers ? (
        <WaiverWirePage />
      ) : path === ROUTES.team ? (
        <MyTeamPage navigate={navigate} />
      ) : placeholder ? (
        <PlaceholderPage title={placeholder} navigate={navigate} />
      ) : (
        <PlaceholderPage title="Page not found" navigate={navigate} />
      )}
    </SeasonLayout>
  );
}
