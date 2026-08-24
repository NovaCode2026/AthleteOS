import type { CloudData } from "../types";

/**
 * Calculates athlete readiness from real cloud data.
 * The result is intentionally deterministic and capped at 100.
 */
export function calculateReadiness(data: CloudData): number {
  const profile = data.profile || {};
  const profileFields = [
    profile.full_name,
    profile.date_of_birth,
    profile.weight_kg,
    profile.height_cm,
    profile.belt,
    profile.academy,
    profile.coach,
  ];
  const profileScore = profileFields.filter((value) => value !== undefined && value !== null && String(value).trim() !== "").length / profileFields.length;

  const trainingScore = Math.min(1, data.training.length / 8);
  const goalsScore = data.goals.length === 0 ? 0 : Math.min(1, data.goals.filter((goal) => String((goal as any).status || "").toLowerCase() === "completed").length / data.goals.length);
  const checklistScore = data.checklist.length === 0 ? 0 : data.checklist.filter((item) => Boolean((item as any).completed || (item as any).is_completed)).length / data.checklist.length;
  const tournamentScore = data.tournaments.length > 0 ? Math.min(1, data.tournaments.length / 3) : 0;
  const documentsScore = Math.min(1, data.documents.length / 3);
  const verificationScore = data.verifications.some((item) => String((item as any).status || "").toLowerCase() === "approved") ? 1 : 0;
  const activityScore = data.training.length > 0 || data.medals.length > 0 || data.weights.length > 0 ? 1 : 0;

  const score = (
    profileScore * 20 +
    trainingScore * 20 +
    tournamentScore * 15 +
    checklistScore * 15 +
    goalsScore * 10 +
    verificationScore * 10 +
    documentsScore * 5 +
    activityScore * 5
  );

  return Math.max(0, Math.min(100, Math.round(score)));
}
