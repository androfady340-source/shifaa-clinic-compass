import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL } from "@/lib/clinic";
import { formatDate, formatTime } from "@/lib/slots";

export const Route = createFileRoute("/track")({
  validateSearch: z.object({ id: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "تابع حجزك — عيادات النعمة" },
      { name: "description", content: "اعرف حالة حجزك بكود الحجز ورقم موبايلك." },
      { property: "og:title", content: "تابع حجزك — عيادات النعمة" },
      { property: "og:description", content: "اعرف حالة حجزك." },
    ],
  }),
  component: TrackPage,
});

type Result = { status: string; booking_date: string; start_time: string; doctor_name: string };

function TrackPage() {
  const search = Route.useSearch();
  const [id, setId] = useState(search.id ?? "");
  const [phone, setPhone] = useState("");
  const [res, setRes] = useState<Result | null | "none">(null);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    if (!z.string().uuid().safeParse(id.trim()).success) return setRes("none");
    setBusy(true);
    const { data } = await supabase.rpc("get_booking_status", { _id: id.trim(), _phone: phone });
    setBusy(false);
    setRes(data && data.length ? (data[0] as Result) : "none");
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-3xl font-bold">تابع حجزك</h1>
      <div className="mt-6 space-y-4 rounded-2xl border bg-card p-5">
        <div className="space-y-1.5">
          <Label>كود الحجز</Label>
          <Input dir="ltr" value={id} onChange={(e) => setId(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>الموبايل</Label>
          <Input dir="ltr" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Button className="w-full rounded-full" disabled={busy} onClick={check}>
          اعرف الحالة
        </Button>
      </div>
      {res === "none" && <p className="mt-6 text-center text-muted-foreground">مفيش حجز بالبيانات دي</p>}
      {res && res !== "none" && (
        <div className="mt-6 space-y-2 rounded-2xl border bg-card p-5 text-center">
          <Badge variant={res.status as "pending"}>{STATUS_LABEL[res.status]}</Badge>
          <p className="font-semibold">د. {res.doctor_name}</p>
          <p className="text-sm text-muted-foreground">
            {formatDate(res.booking_date)} — {formatTime(res.start_time)}
          </p>
        </div>
      )}
    </div>
  );
}
