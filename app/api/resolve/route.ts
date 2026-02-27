import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { PersonData } from "@/types/timeline";

const SYSTEM_PROMPT = `You are a biographical research assistant. Given a list of names, return a JSON array with birth and death information for each recognizable person.

Rules:
- Return ONLY a valid JSON array, no markdown, no explanation, no code fences.
- Each entry must have: name (string), birth_year (integer), death_year (integer or null), category (string), approximate (boolean), description (string).
- death_year is null for living people.
- Use negative integers for BC years (e.g. -69 for 69 BC).
- approximate is true when exact dates are uncertain or debated.
- category must be one of: Scientists, Rulers, Artists, Athletes, Musicians, Writers, Philosophers, Explorers, Inventors, Mathematicians, Architects, Generals, Humanitarians, Theologians, Other
- description is a single quiet, precise sentence — like museum plaque text or an epitaph. State what they were known for, without flair. Max ~120 characters.
- If a name is complete gibberish, fictional (unless clearly a real person known by a pseudonym), or unidentifiable, omit it entirely.
- For people known by a single name or stage name, use the name as provided.

Example output:
[
  {"name":"Cleopatra","birth_year":-69,"death_year":-30,"category":"Rulers","approximate":true,"description":"Last active pharaoh of ancient Egypt, renowned for political alliances with Rome."},
  {"name":"Leonardo da Vinci","birth_year":1452,"death_year":1519,"category":"Artists","approximate":false,"description":"Florentine polymath whose notebooks mapped anatomy, flight, and the nature of water."},
  {"name":"Taylor Swift","birth_year":1989,"death_year":null,"category":"Musicians","approximate":false,"description":"Singer-songwriter who redefined pop narrative through autobiographical lyricism."}
]`;

// ── Provider calls ────────────────────────────────────────────────────────────

// To switch providers, set the matching key in .env.local and restart the server:
//   OPENROUTER_API_KEY  → uses openrouter/free (any available free model)
//   GEMINI_API_KEY      → uses gemini-2.0-flash (free tier, 1500 req/day when available)
//   ANTHROPIC_API_KEY   → uses claude-sonnet-4-6 (paid)
// Priority order: OpenRouter → Gemini → Anthropic

async function callOpenRouter(apiKey: string, userMessage: string): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://timeline-generator.app",
      "X-Title": "Lifelines",
    },
    body: JSON.stringify({
      model: "openrouter/free",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message ?? `OpenRouter error ${res.status}`;
    throw Object.assign(new Error(msg), { status: res.status });
  }

  const json = await res.json();
  return json.choices[0].message.content as string;
}

async function callGemini(apiKey: string, userMessage: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
  });
  const result = await model.generateContent(userMessage);
  return result.response.text();
}

async function callAnthropic(apiKey: string, userMessage: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => (block as { type: "text"; text: string }).text)
    .join("");
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey     = process.env.GEMINI_API_KEY;
  const anthropicKey  = process.env.ANTHROPIC_API_KEY;

  if (!openRouterKey && !geminiKey && !anthropicKey) {
    return NextResponse.json(
      { error: "No API key configured. Add OPENROUTER_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY to .env.local." },
      { status: 500 }
    );
  }

  let names: string[];
  try {
    const body = await request.json();
    names = body.names;
    if (!Array.isArray(names) || names.length === 0) {
      return NextResponse.json({ error: "No names provided." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const userMessage = `Find biographical data for these people:\n${names.map((n, i) => `${i + 1}. ${n}`).join("\n")}`;

  try {
    // Priority: OpenRouter → Gemini → Anthropic
    const rawText = openRouterKey
      ? await callOpenRouter(openRouterKey, userMessage)
      : geminiKey
      ? await callGemini(geminiKey, userMessage)
      : await callAnthropic(anthropicKey!, userMessage);

    let data: PersonData[];
    try {
      // Strip any accidental markdown fences just in case
      const cleaned = rawText
        .replace(/^```(?:json)?\n?/m, "")
        .replace(/\n?```$/m, "")
        .trim();
      data = JSON.parse(cleaned);

      if (!Array.isArray(data)) throw new Error("Response was not an array");

      // Basic shape validation
      data = data.filter(
        (item) =>
          typeof item.name === "string" &&
          typeof item.birth_year === "number" &&
          (item.death_year === null || typeof item.death_year === "number") &&
          typeof item.category === "string" &&
          typeof item.approximate === "boolean"
      );
    } catch (parseError) {
      console.error("Failed to parse AI response:", rawText, parseError);
      return NextResponse.json(
        { error: "Failed to parse AI response. Try again." },
        { status: 502 }
      );
    }

    if (data.length === 0) {
      return NextResponse.json(
        { error: "No valid people found. Check your input and try again." },
        { status: 422 }
      );
    }

    return NextResponse.json({ data });
  } catch (err) {
    const error = err as Error & { status?: number };
    const provider = openRouterKey ? "OpenRouter" : geminiKey ? "Gemini" : "Anthropic";
    console.error(`${provider} API error:`, error);

    if (error.status === 401) {
      return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
    }
    if (error.status === 429) {
      return NextResponse.json(
        { error: "Rate limit reached. Try again shortly." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: error.message ?? "Unexpected error calling the AI." },
      { status: 500 }
    );
  }
}
