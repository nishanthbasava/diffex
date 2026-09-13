import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a clinical NLP extraction engine. Given a clinical note, extract ALL clinical findings, symptoms, signs, and relevant history items.

For each finding, return:
- term: the canonical clinical term (e.g. "Sore throat", "Posterior oral vesicles", "Odynophagia")
- type: one of "symptom", "history", "vital", "lab", "test", "other"
- value_type: one of "boolean", "numeric", "categorical"  
- polarity: "present" or "absent" (absent if negated in the note)
- value: the value if numeric/categorical, otherwise null

Important rules:
- Extract EVERY clinical finding mentioned, even common ones
- Properly detect negation (e.g. "no fever" → fever is absent)
- Use standard medical terminology for the canonical term
- Include demographics (age, sex) if mentioned
- Include pertinent negatives (things explicitly denied)
- Do NOT hallucinate findings not in the note
- For age in months (e.g. "18 month old"), convert to years (1.5) and also extract as a separate "Age" finding with numeric value
- For sex abbreviations (F/M), extract as "Sex" with categorical value "Female"/"Male"`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { noteText, vocabulary } = await req.json();
    if (!noteText || typeof noteText !== "string") {
      return new Response(
        JSON.stringify({ error: "noteText is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + (typeof vocabulary === 'string' ? vocabulary : '') },
            { role: "user", content: `Extract all clinical findings from this note:\n\n${noteText}` },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "report_findings",
                description: "Report all extracted clinical findings from the note.",
                parameters: {
                  type: "object",
                  properties: {
                    findings: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          term: { type: "string", description: "Canonical clinical term" },
                          type: { type: "string", enum: ["symptom", "history", "vital", "lab", "test", "other"] },
                          value_type: { type: "string", enum: ["boolean", "numeric", "categorical"] },
                          polarity: { type: "string", enum: ["present", "absent"] },
                          value: { description: "Numeric or categorical value, or null for boolean" },
                        },
                        required: ["term", "type", "value_type", "polarity"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["findings"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "report_findings" } },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage limit reached. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error("No tool call in AI response");
    }

    const findings = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(findings), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-clinical-terms error:", e);
    const errorMessage = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
