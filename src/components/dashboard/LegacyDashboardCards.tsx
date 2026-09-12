import { Sparkles } from "lucide-react";
import type { UsageSummary } from "../../types";

type Props = {
  usage: UsageSummary;
  onOpenAi: () => void;
};

/** Compact, interactive AI usage card. Legacy dashboard metrics intentionally stay removed. */
export default function LegacyDashboardCards({ usage, onOpenAi }: Props) {
  const used = Math.max(0, usage.used);
  const limit = Math.max(0, usage.limit);
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <button type="button" className="ai-usage-card card" onClick={onOpenAi} aria-label="Open AI Coach and view AI usage">
      <div className="ai-usage-icon"><Sparkles size={19} /></div>
      <div className="ai-usage-copy">
        <span className="eyebrow">AI usage</span>
        <strong>{used}/{limit}</strong>
        <small>{usage.plan.name} plan · {Math.max(0, limit - used)} remaining</small>
        <i className="ai-usage-bar"><em style={{ width: `${percent}%` }} /></i>
      </div>
      <span className="ai-usage-open">Open AI Coach →</span>
    </button>
  );
}
