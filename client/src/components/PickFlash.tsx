import type { PickFeedback } from "../hooks/useDraftRoom";

interface PickFlashProps {
  feedback: PickFeedback | null;
}

export function PickFlash({ feedback }: PickFlashProps) {
  if (!feedback) {
    return null;
  }

  return (
    <div className="pick-flash" role="status">
      Pick {feedback.label} — {feedback.playerName} — Team {feedback.teamSlot}
    </div>
  );
}
