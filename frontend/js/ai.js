export async function processAI(message) {

  try {

    const res = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {

        method: "POST",

        headers: {

          "Authorization":
            `Bearer ${process.env.OPENAI_KEY}`,

          "Content-Type": "application/json"
        },

        body: JSON.stringify({

          model: "gpt-4o-mini",

          response_format: {
            type: "json_object"
          },

          messages: [

            {
              role: "system",

              content: `

You are an AI CRM assistant
for a real-estate platform.

Your job:
- understand customer intent
- classify lead quality
- decide follow-up priority
- recommend next action
- help automate CRM workflow

Return STRICT JSON only.

JSON FORMAT:

{
  "intent": "",

  "date": "",

  "time_preference": "",

  "lead_temperature": "",

  "priority": "",

  "followup_type": "",

  "next_followup_hours": 0,

  "should_schedule_followup": true,

  "should_notify_agent": false,

  "suggested_reply": "",

  "reason": ""
}

--------------------------------

Intent values:
- schedule_visit
- confirm_visit
- negotiation
- pricing
- loan_query
- interested
- not_interested
- callback_request
- general

--------------------------------

Lead temperature:
- hot
- warm
- cold

--------------------------------

Priority:
- high
- medium
- low

--------------------------------

Follow-Up Types:
- Site Visit
- Call Back
- Price Negotiation
- Payment Reminder
- General Follow-Up

--------------------------------

Rules:

1. If customer asks about:
price, booking, loan, visit,
availability, payment,
then lead_temperature = hot

2. If customer says:
later, busy, will check,
then lead_temperature = cold

3. If customer asks for callback:
intent = callback_request

4. If customer asks for visit:
intent = schedule_visit

5. High intent leads:
should_notify_agent = true

6. If follow-up needed:
should_schedule_followup = true

7. Return ONLY JSON

`
            },

            {
              role: "user",
              content: message
            }
          ]
        })
      }
    );

    const data = await res.json();

    console.log(
      "AI RAW RESPONSE:",
      data
    );

    const content =
      data?.choices?.[0]?.message?.content;

    if (!content) {

      throw new Error(
        "Empty AI response"
      );
    }

    const parsed =
      JSON.parse(content);

    return {

      intent:
        parsed.intent || "general",

      date:
        parsed.date || "",

      time_preference:
        parsed.time_preference || "",

      lead_temperature:
        parsed.lead_temperature || "warm",

      priority:
        parsed.priority || "medium",

      followup_type:
        parsed.followup_type ||
        "General Follow-Up",

      next_followup_hours:
        parsed.next_followup_hours || 24,

      should_schedule_followup:
        parsed.should_schedule_followup || false,

      should_notify_agent:
        parsed.should_notify_agent || false,

      suggested_reply:
        parsed.suggested_reply || "",

      reason:
        parsed.reason || "No reason"
    };

  } catch (err) {

    console.error(
      "AI PROCESS ERROR:",
      err
    );

    return {

      intent: "general",

      date: "",

      time_preference: "",

      lead_temperature: "warm",

      priority: "medium",

      followup_type:
        "General Follow-Up",

      next_followup_hours: 24,

      should_schedule_followup: false,

      should_notify_agent: false,

      suggested_reply: "",

      reason: "fallback"
    };
  }
}
