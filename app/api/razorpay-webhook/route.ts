import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET as string;

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature") as string;

    const expectedSignature = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== signature) {
      return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;

      const name = payment.notes?.name || "Unknown";
      const phone = payment.contact || "";
      const email = payment.email || "";
      const amount = (payment.amount ?? 0) / 100;
      const transactionId = payment.id;
      const status = payment.status;
      const paymentTime = new Date((payment.created_at ?? 0) * 1000).toISOString();
      const campaign = payment.notes?.campaign || "General";

      let donorId: string | null = null;

      if (phone || email) {
        let query = supabase.from("donors_razorpay").select("donor_id, name, phone_number, email").limit(1);
        if (phone && email) {
          query = query.or(`phone_number.eq.${phone},email.eq.${email}`);
        } else if (phone) {
          query = query.eq("phone_number", phone);
        } else if (email) {
          query = query.eq("email", email);
        }

        const { data: found } = await query;
        if (found && found.length > 0) {
          donorId = found[0].donor_id;

          const updatePatch: Record<string, any> = {};
          if (name && name !== found[0].name) updatePatch.name = name;
          if (phone && phone !== found[0].phone_number) updatePatch.phone_number = phone;
          if (email && email !== found[0].email) updatePatch.email = email;

          if (Object.keys(updatePatch).length > 0) {
            await supabase.from("donors_razorpay").update(updatePatch).eq("donor_id", donorId);
          }
        }
      }

      if (!donorId) {
        const insertObj: Record<string, any> = {};
        if (name) insertObj.name = name;
        if (phone) insertObj.phone_number = phone;
        if (email) insertObj.email = email;

        const { data: inserted, error: insertError } = await supabase
          .from("donors_razorpay")
          .insert(insertObj)
          .select("donor_id")
          .single();

        if (insertError) {
          console.error("Donor insert error:", insertError);
          return NextResponse.json({ success: false, error: "Donor insert failed" });
        }

        donorId = inserted.donor_id;
      }

      await supabase.from("payments").upsert(
        {
          user_id: donorId,
          amount,
          transaction_id: transactionId,
          status,
          payment_time: paymentTime,
          campaign,
        },
        { onConflict: "transaction_id" }
      );
    }

    return NextResponse.json({ success: true });
} catch (err: any) {
  console.error("Webhook error:", err);
  return NextResponse.json({ success: false, error: err.message }, { status: 500 });
}
}
