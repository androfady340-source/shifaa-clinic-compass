import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL } from "@/lib/clinic";
import { cairoNow, formatDate, formatTime } from "@/lib/slots";

type Status = "pending" | "confirmed" | "cancelled" | "completed";

export function BookingsList({ doctorId, showDoctor }: { doctorId?: string; showDoctor?: boolean }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"upcoming" | "pending" | "all">("upcoming");
  const today = cairoNow().date;
  const key = ["bookings", doctorId ?? "all", filter];
  const { data = [], isLoading } = useQuery({
    queryKey: key,
    refetchInterval: 30000,
    queryFn: async () => {
      let q = supabase
        .from("bookings")
        .select("*, doctors(full_name)")
        .order("booking_date", { ascending: filter !== "all" })
        .order("start_time")
        .limit(300);
      if (doctorId) q = q.eq("doctor_id", doctorId);
      if (filter === "upcoming") q = q.gte("booking_date", today).in("status", ["pending", "confirmed"]);
      if (filter === "pending") q = q.eq("status", "pending");
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const setStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) return toast.error("حصلت مشكلة");
    toast.success(STATUS_LABEL[status]);
    qc.invalidateQueries({ queryKey: ["bookings"] });
  };

  const tab = (v: typeof filter, l: string) => (
    <button
      onClick={() => setFilter(v)}
      className={`rounded-full px-3 py-1.5 text-sm ${filter === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
    >
      {l}
    </button>
  );

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {tab("upcoming", "القادمة")}
        {tab("pending", "تحتاج تأكيد")}
        {tab("all", "الكل")}
      </div>
      {isLoading ? (
        <p className="text-muted-foreground">جاري التحميل…</p>
      ) : data.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">مفيش حجوزات</p>
      ) : (
        <div className="space-y-3">
          {data.map((b) => (
            <div key={b.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{b.patient_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(b.booking_date)} — {formatTime(b.start_time)}
                    {showDoctor && ` · د. ${b.doctors?.full_name ?? ""}`}
                  </p>
                </div>
                <Badge variant={b.status as Status}>{STATUS_LABEL[b.status]}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <a href={`tel:${b.patient_phone}`} dir="ltr" className="flex items-center gap-1 text-primary">
                  <Phone className="size-3.5" /> {b.patient_phone}
                </a>
                <span>{b.payment_method === "instapay" ? `إنستا باي — المحوِّل: ${b.instapay_ref}` : "دفع في العيادة"}</span>
                {b.notes && <span className="text-muted-foreground">ملاحظة: {b.notes}</span>}
              </div>
              {(b.status === "pending" || b.status === "confirmed") && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {b.status === "pending" && (
                    <Button size="sm" onClick={() => setStatus(b.id, "confirmed")}>
                      تأكيد
                    </Button>
                  )}
                  {b.status === "confirmed" && (
                    <Button size="sm" variant="secondary" onClick={() => setStatus(b.id, "completed")}>
                      تم الكشف
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setStatus(b.id, "cancelled")}>
                    إلغاء
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
