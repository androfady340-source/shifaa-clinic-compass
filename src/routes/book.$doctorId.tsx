import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Copy, Smartphone, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { doctorQuery } from "@/lib/queries";
import { addDays, cairoNow, formatDate, formatTime, generateSlots, isSlotPast, weekdayOf, WEEKDAYS } from "@/lib/slots";
import { CLINIC, errorText } from "@/lib/clinic";

export const Route = createFileRoute("/book/$doctorId")({
  head: () => ({
    meta: [
      { title: "احجز ميعاد — عيادات النعمة" },
      { name: "description", content: "اختار اليوم والساعة واحجز كشفك." },
      { property: "og:title", content: "احجز ميعاد — عيادات النعمة" },
      { property: "og:description", content: "اختار اليوم والساعة واحجز كشفك." },
    ],
  }),
  component: BookPage,
});

const formSchema = z.object({
  name: z.string().trim().min(2, "اكتب اسمك").max(100),
  phone: z.string().trim().regex(/^\+?[0-9]{8,15}$/, "رقم الموبايل غير صحيح"),
  notes: z.string().max(500),
});

function BookPage() {
  const { doctorId } = Route.useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(doctorQuery(doctorId));
  const today = cairoNow().date;
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [payment, setPayment] = useState<"instapay" | "clinic">("clinic");
  const [form, setForm] = useState({ name: "", phone: "", notes: "", ref: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ id: string } | null>(null);

  const doctor = data?.doctor;
  const days = useMemo(() => {
    if (!data) return [];
    const out: string[] = [];
    for (let i = 0; i < 21; i++) {
      const d = addDays(today, i);
      const wd = weekdayOf(d);
      if (data.availability.some((a) => a.weekday === wd) && !data.daysOff.includes(d)) out.push(d);
    }
    return out;
  }, [data, today]);

  const taken = useQuery({
    queryKey: ["taken", doctorId, date],
    enabled: !!date,
    refetchInterval: 20000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_taken_slots", { _doctor: doctorId, _date: date! });
      if (error) throw error;
      return (data as string[]).map((t) => t.slice(0, 5));
    },
  });

  const slots = useMemo(() => {
    if (!data || !doctor || !date) return [];
    const ranges = data.availability
      .filter((a) => a.weekday === weekdayOf(date))
      .map((a) => ({ start_time: a.start_time.slice(0, 5), end_time: a.end_time.slice(0, 5) }));
    return generateSlots(ranges, doctor.slot_minutes);
  }, [data, doctor, date]);

  if (isLoading) return <p className="py-20 text-center text-muted-foreground">جاري التحميل…</p>;
  if (!doctor)
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">الطبيب غير متاح</p>
        <Link to="/doctors" className="mt-4 inline-block text-primary">
          رجوع للأطباء
        </Link>
      </div>
    );

  const submit = async () => {
    if (!date || !time) return toast.error("اختار اليوم والساعة");
    const parsed = formSchema.safeParse(form);
    if (!parsed.success) return toast.error(parsed.error.issues[0]?.message ?? "راجع البيانات");
    if (payment === "instapay" && form.ref.trim().length < 3) return toast.error("اكتب اسم أو رقم المحوِّل");
    setBusy(true);
    const { data: id, error } = await supabase.rpc("create_booking", {
      _doctor: doctorId,
      _date: date,
      _time: time,
      _name: parsed.data.name,
      _phone: parsed.data.phone,
      _payment: payment,
      _instapay_ref: payment === "instapay" ? form.ref.trim() : "",
      _notes: parsed.data.notes,
    });
    setBusy(false);
    qc.invalidateQueries({ queryKey: ["taken", doctorId, date] });
    if (error) {
      setTime(null);
      return toast.error(errorText(error));
    }
    setDone({ id: id as string });
  };

  if (done)
    return (
      <div className="mx-auto max-w-md px-4 py-14 text-center">
        <CheckCircle2 className="mx-auto size-16 text-success" />
        <h1 className="mt-4 text-2xl font-bold">تم الحجز</h1>
        <p className="mt-2 text-muted-foreground">
          د. {doctor.full_name} — {formatDate(date!)} — {formatTime(time!)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {payment === "instapay" ? "هيتم التأكيد بعد مراجعة التحويل." : "الدفع في العيادة."}
        </p>
        <div className="mt-6 rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">كود الحجز (احتفظ بيه)</p>
          <button
            className="mt-1 flex w-full items-center justify-center gap-2 font-mono text-sm"
            dir="ltr"
            onClick={() => {
              navigator.clipboard.writeText(done.id);
              toast.success("اتنسخ");
            }}
          >
            {done.id.slice(0, 8)}… <Copy className="size-4" />
          </button>
        </div>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/track" search={{ id: done.id }}>
            تابع حالة الحجز
          </Link>
        </Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-2xl border bg-card p-5">
        <h1 className="text-2xl font-bold">د. {doctor.full_name}</h1>
        <p className="text-sm text-muted-foreground">
          {doctor.specialties?.name} {doctor.title && `· ${doctor.title}`} · الكشف {doctor.fee} ج
        </p>
        {doctor.bio && <p className="mt-2 text-sm">{doctor.bio}</p>}
      </div>

      <h2 className="mt-8 mb-3 font-semibold">١. اختار اليوم</h2>
      {days.length === 0 ? (
        <p className="text-muted-foreground">مفيش مواعيد متاحة حالياً</p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {days.map((d) => {
            const active = d === date;
            return (
              <button
                key={d}
                onClick={() => {
                  setDate(d);
                  setTime(null);
                }}
                className={`flex min-w-20 shrink-0 flex-col items-center rounded-2xl border px-3 py-2 text-sm transition ${active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}
              >
                <span className="text-xs opacity-80">{WEEKDAYS[weekdayOf(d)]}</span>
                <span className="text-lg font-bold">{Number(d.slice(8))}</span>
                <span className="text-xs opacity-80">{d === today ? "النهارده" : `/${Number(d.slice(5, 7))}`}</span>
              </button>
            );
          })}
        </div>
      )}

      {date && (
        <>
          <h2 className="mt-8 mb-3 font-semibold">٢. اختار الساعة</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {slots.map((s) => {
              const isTaken = taken.data?.includes(s);
              const past = isSlotPast(date, s);
              const disabled = isTaken || past || taken.isLoading;
              const active = s === time;
              return (
                <button
                  key={s}
                  disabled={disabled}
                  onClick={() => setTime(s)}
                  className={`rounded-xl border py-2 text-sm transition ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : disabled
                        ? "cursor-not-allowed bg-muted text-muted-foreground line-through opacity-60"
                        : "bg-card hover:border-primary"
                  }`}
                >
                  {formatTime(s)}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">المواعيد المشطوبة محجوزة أو عدّت.</p>
        </>
      )}

      {time && (
        <div className="mt-8 space-y-4">
          <h2 className="font-semibold">٣. بياناتك</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>الاسم</Label>
              <Input value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>الموبايل</Label>
              <Input dir="ltr" inputMode="tel" value={form.phone} maxLength={16} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>ملاحظات (اختياري)</Label>
            <Textarea rows={2} maxLength={500} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>

          <h2 className="pt-2 font-semibold">٤. طريقة الدفع</h2>
          <div className="grid grid-cols-2 gap-2">
            {doctor.accepts_clinic && (
              <PayOption active={payment === "clinic"} onClick={() => setPayment("clinic")} icon={<Building2 />} label="في العيادة" />
            )}
            {doctor.accepts_instapay && (
              <PayOption active={payment === "instapay"} onClick={() => setPayment("instapay")} icon={<Smartphone />} label="إنستا باي" />
            )}
          </div>
          {payment === "instapay" && (
            <div className="space-y-3 rounded-2xl bg-primary-soft p-4">
              <p className="text-sm">
                حوّل <b>{doctor.fee} ج</b> على إنستا باي للرقم:
              </p>
              <button
                dir="ltr"
                className="flex items-center gap-2 text-xl font-bold"
                onClick={() => {
                  navigator.clipboard.writeText(CLINIC.instapay);
                  toast.success("اتنسخ الرقم");
                }}
              >
                {CLINIC.instapay} <Copy className="size-4" />
              </button>
              <div className="space-y-1.5">
                <Label>اسم أو رقم اللي حوّل</Label>
                <Input value={form.ref} maxLength={100} onChange={(e) => setForm({ ...form, ref: e.target.value })} />
              </div>
            </div>
          )}

          <Button size="lg" className="w-full rounded-full" disabled={busy} onClick={submit}>
            {busy ? "جاري الحجز…" : `تأكيد الحجز — ${formatTime(time)}`}
          </Button>
        </div>
      )}
    </div>
  );
}

function PayOption({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-2xl border p-4 text-sm font-medium transition [&_svg]:size-5 ${active ? "border-primary bg-primary-soft text-foreground" : "bg-card"}`}
    >
      {icon} {label}
    </button>
  );
}
