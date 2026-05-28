import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const schema = z.object({
  razorpay_order_id: z.string().min(4),
  razorpay_payment_id: z.string().min(4),
  razorpay_signature: z.string().min(8),
  plan: z.enum(["pro", "institute"]),
});

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = schema.parse(await req.json());
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Razorpay not configured." }, { status: 503 });
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
      .digest("hex");

    if (expected !== body.razorpay_signature) {
      return NextResponse.json({ error: "Signature mismatch" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabaseAdmin as any;
    await db
      .from("profiles")
      .update({ plan: body.plan })
      .eq("id", user.id);

    // Optional audit row (non-blocking).
    await db.from("analysis_cache").upsert({
      cache_key: `payment-${body.razorpay_payment_id}`,
      response_json: {
        type: "payment",
        userId: user.id,
        plan: body.plan,
        order: body.razorpay_order_id,
        payment: body.razorpay_payment_id,
        verifiedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ upgraded: true, plan: body.plan });
  } catch (e) {
    console.error("razorpay verify error", e);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
