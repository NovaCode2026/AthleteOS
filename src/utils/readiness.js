export function calculateReadiness(data) {
  if (!data || !data.profile) return 0;

  let score = 0;
  const profile = data.profile;
  const profileFields = ["full_name", "belt", "academy", "coach", "emergency_contact"];
  const completedProfileFields = profileFields.filter((field) => String(profile[field] || "").trim()).length;
  score += (completedProfileFields / profileFields.length) * 20;

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const recentTraining = (data.training || []).filter((session) => {
    const time = new Date(`${session.session_date || ""}T00:00:00`).getTime();
    return Number.isFinite(time) && time >= thirtyDaysAgo;
  }).length;
  score += Math.min(20, recentTraining * 2);

  const goalProgress = (data.goals || []).length
    ? (data.goals || []).reduce((total, goal) => total + Math.max(0, Math.min(100, Number(goal.progress || 0))), 0) / data.goals.length
    : 0;
  score += goalProgress * 0.15;

  const upcomingTournaments = (data.tournaments || []).filter((tournament) => {
    if (!tournament.starts_at) return false;
    const time = new Date(`${tournament.starts_at}T00:00:00`).getTime();
    return Number.isFinite(time) && time >= now;
  }).length;
  score += Math.min(15, upcomingTournaments * 5);

  score += Math.min(15, (data.weights || []).length * 3);
  score += Math.min(10, (data.documents || []).length * 2 + (profile.verified_athlete ? 4 : 0));

  return Math.max(0, Math.min(100, Math.round(score)));
}
