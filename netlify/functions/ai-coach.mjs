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

export default async function handler(request) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed." }, { status: 405 });
  }

  const { topic, prompt } = await request.json().catch(() => ({}));
  if (!allowedTopics.has(topic) || !prompt?.trim()) {
    return Response.json({ error: "Choose a topic and enter a prompt." }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return Response.json({ error: "OpenAI is not configured on the server." }, { status: 500 });
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
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
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    return Response.json({ error: payload.error?.message || "AI request failed." }, { status: 500 });
  }

  const answer = payload.output_text
    || payload.output?.flatMap(item => item.content || []).map(item => item.text || "").join("")
    || "No response generated.";

  return Response.json({ answer });
}
