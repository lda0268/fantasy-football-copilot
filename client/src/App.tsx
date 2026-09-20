import { DraftRoom } from "./components/DraftRoom";
import { ROUTES } from "./app/routes";
import { usePathname } from "./app/usePathname";
import { DashboardPage } from "./season/DashboardPage";
import { LeaguePage } from "./season/LeaguePage";
import { MyTeamPage } from "./season/MyTeamPage";
import { PlaceholderPage } from "./season/PlaceholderPage";
import { PlayersPage } from "./season/PlayersPage";
import { SeasonLayout } from "./season/SeasonLayout";
import { StartSitPage } from "./season/StartSitPage";
import { WaiverWirePage } from "./season/WaiverWirePage";
import "./styles/draft.css";
import "./styles/season.css";

const PLACEHOLDERS: Record<string, string> = {
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
      ) : path === ROUTES.startSit ? (
        <StartSitPage />
      ) : path === ROUTES.players ? (
        <PlayersPage navigate={navigate} />
      ) : path === ROUTES.league ? (
        <LeaguePage navigate={navigate} />
      ) : placeholder ? (
        <PlaceholderPage title={placeholder} navigate={navigate} />
      ) : (
        <PlaceholderPage title="Page not found" navigate={navigate} />
      )}
    </SeasonLayout>
  );
}
