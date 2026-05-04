export async function processAI(message) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
Extract intent from message.
Return JSON only:
{
  "intent": "schedule_visit | confirm_visit | negotiation | general",
  "date": "",
  "time_preference": ""
}
`
        },
        { role: "user", content: message }
      ]
    })
  });

  const data = await res.json();

  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return { intent: "general" };
  }
}
