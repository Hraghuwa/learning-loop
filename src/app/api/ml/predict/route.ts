import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ML_BACKEND_URL = process.env.ML_BACKEND_URL ?? "http://localhost:8000";

const requestSchema = z.object({
  problem: z.string().min(3).max(2000),
  topK: z.number().int().min(1).max(10).optional().default(3),
  mode: z
    .enum(["classify", "retrieve", "generate", "predict-all"])
    .optional()
    .default("predict-all"),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { problem, topK, mode } = parsed.data;
  const endpoint = `${ML_BACKEND_URL}/${mode}`;

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problem, top_k: topK }),
      // Backend models can be slow on first cold-start load
      signal: AbortSignal.timeout(120_000),
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      return NextResponse.json(
        { error: "ML backend error", status: upstream.status, detail: text },
        { status: 502 },
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Could not reach ML backend",
        hint: `Is uvicorn running at ${ML_BACKEND_URL}?`,
        message,
      },
      { status: 503 },
    );
  }
}

export async function GET() {
  try {
    const upstream = await fetch(`${ML_BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    const data = await upstream.json();
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: "ML backend unreachable", message },
      { status: 503 },
    );
  }
}
