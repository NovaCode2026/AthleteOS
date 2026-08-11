import type { Plan } from "../types";

export const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    aiLimit: 0,
    audience: "New athletes",
    features: ["Core dashboard", "Training and medals", "Secure documents", "No AI Coach access"]
  },
  {
    id: "student",
    name: "Student",
    price: "₹79/month",
    aiLimit: 50,
    audience: "Verified students",
    features: ["Student verification", "50 AI coach messages", "Resume PDF readiness", "Priority roadmap voting"]
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹149/month",
    aiLimit: 100,
    audience: "Competitive athletes",
    features: ["100 AI coach messages", "Advanced analytics", "Goal tracking", "Referral rewards"]
  },
  {
    id: "champion",
    name: "Champion",
    price: "₹299/month",
    aiLimit: 500,
    audience: "Elite competitors",
    features: ["500 AI coach messages", "Founder badge eligibility", "Performance reports", "Emergency profile"]
  },
  {
    id: "academy",
    name: "Academy",
    price: "₹999+/month",
    aiLimit: 2000,
    audience: "Clubs and academies",
    features: ["Academy dashboard", "Admin workflows", "Team analytics", "Bulk verification"]
  }
];

export function getPlan(id?: string): Plan {
  return plans.find((plan) => plan.id === id) ?? plans[0];
}
