import { NextResponse } from "next/server";
import Razorpay from "razorpay";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  amount: z.number().int().min(100).max(10000000), // paise (₹1 - ₹100,000)
  plan: z.enum(["pro", "institute"]),
});

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const body = schema.parse(await req.json());

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay not configured on this deployment. Email hello@learningloop.in." },
        { status: 503 },
      );
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const order = await razorpay.orders.create({
      amount: body.amount,
      currency: "INR",
      receipt: `ll-${user.id.slice(0, 8)}-${Date.now()}`,
      notes: {
        userId: user.id,
        plan: body.plan,
      },
    });

    return NextResponse.json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
    });
  } catch (e) {
    console.error("razorpay order error", e);
    return NextResponse.json({ error: "Unable to create order." }, { status: 500 });
  }
}
