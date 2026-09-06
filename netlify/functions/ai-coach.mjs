import { createClient } from "@supabase/supabase-js";

const allowedTopics = new Set([
  "Training Coach",
  "Tournament Preparation",
  "Match Analysis",
  "Nutrition Advice",
  "Recovery Advice",
  "Goal Suggestions",
  "Performance Reports",
  "Motivational Feedback"
]);

const planLimits = {
  free: 0,
  student: 50,
  pro: 100,
  champion: 500,
  academy: 2000
};

function json(error, status) {
  return Response.json({ error }, { status });
}

function env(name) {
  return globalThis.Netlify?.env?.get?.(name) || process.env[name];
}

function createUserSupabaseClient(accessToken) {
  const supabaseUrl = env("VITE_SUPABASE_URL") || env("SUPABASE_URL");
  const supabaseAnonKey = env("VITE_SUPABASE_ANON_KEY") || env("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("SUPABASE_PUBLIC_CONFIG_MISSING");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getMonthStartIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function extractAnswer(payload) {
  if (!payload || typeof payload !== "object") return "";
  if (typeof payload.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const output = Array.isArray(payload.output) ? payload.output : [];
  const chunks = [];
  for (const item of output) {
    const contents = Array.isArray(item?.content) ? item.content : [];
    for (const part of contents) {
      if (typeof part?.text === "string") chunks.push(part.text);
      if (typeof part?.output_text === "string") chunks.push(part.output_text);
      if (typeof part?.content === "string") chunks.push(part.content);
    }
  }
  if (chunks.length) return chunks.join("\n").trim();
  const message = Array.isArray(payload.choices) ? payload.choices[0]?.message?.content : null;
  if (typeof message === "string") return message.trim();
  if (Array.isArray(message)) return message.map((part) => part?.text || part?.content || "").join("").trim();
  return "";
}

export default async function handler(request) {
  if (request.method !== "POST") {
    return json("Method not allowed.", 405);
  }

  const { topic, prompt } = await request.json().catch(() => ({}));
  if (!allowedTopics.has(topic) || !prompt?.trim()) {
    return json("Choose a topic and enter a prompt.", 400);
  }

  const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!accessToken) {
    return json("Please sign in again before using AI Coach.", 401);
  }

  let supabase;
  try {
    supabase = createUserSupabaseClient(accessToken);
  } catch {
    return json("AthleteOS services are not configured for AI access.", 503);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
  if (userError || !userData?.user) {
    return json("Please sign in again before using AI Coach.", 401);
  }

  const userId = userData.user.id;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, plan_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    return json("Unable to verify your AI entitlement.", 503);
  }
  if (!profile) {
    return json("Complete onboarding before using AI Coach.", 403);
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from("subscriptions")
    .select("plan_id, status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .maybeSingle();

  if (subscriptionError) {
    return json("Unable to verify your subscription.", 503);
  }

  const planId = subscription?.plan_id || profile.plan_id || "free";
  const monthlyLimit = planLimits[planId] ?? 0;

  if (monthlyLimit <= 0) {
    return json("AI Coach is not available on the Free plan.", 403);
  }

  const { count, error: usageError } = await supabase
    .from("ai_usage_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", getMonthStartIso());

  if (usageError) {
    return json("Unable to verify your monthly AI usage.", 503);
  }

  if ((count ?? 0) >= monthlyLimit) {
    return json("Monthly AI limit reached for your current plan.", 429);
  }

  const openAiKey = env("OPENAI_API_KEY");
  if (!openAiKey) {
    return json("AI Coach is temporarily unavailable.", 503);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("timeout")), 20000);
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: env("OPENAI_MODEL") || "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: "You are AthleteOS, a careful Taekwondo performance assistant. Give practical, age-safe, non-medical guidance. Encourage professional medical help for injuries."
          },
          {
            role: "user",
            content: `Topic: ${topic}\nAthlete request: ${prompt}`
          }
        ]
      }),
      signal: controller.signal
    });
  } catch (error) {
    clearTimeout(timeout);
    if (controller.signal.aborted) {
      return json("AI Coach request timed out. Please try again.", 504);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return json("AI Coach request failed. Please try again later.", 502);
  }

  const answer = extractAnswer(payload) || "No response generated.";

  const { error: meterError } = await supabase.from("ai_usage_events").insert({
    user_id: userId,
    plan_id: planId,
    topic,
    tokens_used: payload.usage?.total_tokens ?? 0
  });

  if (meterError) {
    return Response.json({
      answer,
      warning: "AI response generated, but usage metering will be retried later."
    });
  }

  return Response.json({ answer });
}
