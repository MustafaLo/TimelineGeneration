import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";
import { NotableEvent } from "@/lib/eventCache";

const CURRENT_YEAR = 2026;
const EXTENSION = 25;

const SYSTEM_PROMPT = `You are a historical research assistant. Given a person's name and life dates, return notable events as a JSON array.

Rules:
- Return ONLY a valid JSON array, no markdown, no explanation, no code fences.
- Each entry must have: year (integer), label (string, 3-6 words).
- Return exactly 10-12 events spread across the full date range provided.
- Include events from science, politics, culture, technology, exploration, art — varied topics.
- Space events across the decades — do not cluster them in one period.
- If the person is deceased, include events from both within their lifetime and after their death.
- No two events should share the same year.
- Labels should be crisp and descriptive: "Moon landing", "French Revolution begins", "Edison's lightbulb patented".

Example output:
[{"year":1789,"label":"French Revolution begins"},{"year":1804,"label":"Steam locomotive built"},{"year":1879,"label":"Edison patents lightbulb"}]`;

async function callOpenRouter(apiKey: string, msg: string): Promise<string> {
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
        { role: "user",   content: msg },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg2 = err?.error?.message ?? `OpenRouter error ${res.status}`;
    throw Object.assign(new Error(msg2), { status: res.status });
  }

  const json = await res.json();
  return json.choices[0].message.content as string;
}

async function callGemini(apiKey: string, msg: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_PROMPT,
  });
  const result = await model.generateContent(msg);
  return result.response.text();
}

async function callAnthropic(apiKey: string, msg: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: msg }],
  });
  return message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");
}

export async function POST(request: NextRequest) {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const geminiKey     = process.env.GEMINI_API_KEY;
  const anthropicKey  = process.env.ANTHROPIC_API_KEY;

  if (!openRouterKey && !geminiKey && !anthropicKey) {
    return NextResponse.json(
      { error: "No API key configured." },
      { status: 500 }
    );
  }

  let name: string;
  let birth_year: number;
  let death_year: number | null;

  try {
    const body = await request.json();
    name       = body.name;
    birth_year = body.birth_year;
    death_year = body.death_year ?? null;

    if (!name || typeof birth_year !== "number") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const isAlive  = death_year === null;
  const gridEnd  = isAlive
    ? CURRENT_YEAR
    : Math.min((death_year as number) + EXTENSION, CURRENT_YEAR);
  const deathStr = isAlive ? `still living (${CURRENT_YEAR})` : String(death_year);

  const userMessage =
    `Person: ${name}. Born: ${birth_year}. Died: ${deathStr}. ` +
    `Return 10-12 notable events from ${birth_year} to ${gridEnd}.`;

  try {
    // Priority: OpenRouter → Gemini → Anthropic
    const rawText = openRouterKey
      ? await callOpenRouter(openRouterKey, userMessage)
      : geminiKey
      ? await callGemini(geminiKey, userMessage)
      : await callAnthropic(anthropicKey!, userMessage);

    let events: NotableEvent[];
    try {
      const cleaned = rawText
        .replace(/^```(?:json)?\n?/m, "")
        .replace(/\n?```$/m, "")
        .trim();
      events = JSON.parse(cleaned);
      if (!Array.isArray(events)) throw new Error("Not an array");

      events = events.filter(
        (e) => typeof e.year === "number" && typeof e.label === "string"
      );
    } catch {
      return NextResponse.json(
        { error: "Failed to parse events response." },
        { status: 502 }
      );
    }

    return NextResponse.json({ events });
  } catch (err) {
    const error = err as Error & { status?: number };
    return NextResponse.json(
      { error: error.message ?? "Unexpected error." },
      { status: error.status ?? 500 }
    );
  }
}
