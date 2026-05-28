import crypto from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Razorpay webhook — backstop for the inline verify call. If the user closes
 * their browser before the verify roundtrip completes, this endpoint catches
 * the same payment.captured event server-to-server and upgrades the plan.
 *
 * Configure on the Razorpay dashboard:
 *   URL:    https://your-domain/api/payments/razorpay/webhook
 *   Events: payment.captured, payment.failed
 *   Secret: RAZORPAY_WEBHOOK_SECRET (env)
 */

export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = req.headers.get("x-razorpay-signature") ?? "";
  const raw = await req.text();
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");

  if (expected !== signature) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  type Payload = {
    event: string;
    payload?: {
      payment?: {
        entity?: {
          id?: string;
          status?: string;
          notes?: Record<string, string>;
        };
      };
    };
  };

  let body: Payload;
  try {
    body = JSON.parse(raw) as Payload;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  if (body.event !== "payment.captured") {
    return NextResponse.json({ ok: true, ignored: body.event });
  }

  const notes = body.payload?.payment?.entity?.notes ?? {};
  const userId = notes.userId;
  const plan = notes.plan;
  if (!userId || !plan || (plan !== "pro" && plan !== "institute")) {
    return NextResponse.json({ ok: true, ignored: "missing-notes" });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;
  await db.from("profiles").update({ plan }).eq("id", userId);

  return NextResponse.json({ ok: true, upgraded: true });
}
