import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { BookingsList } from "@/components/BookingsList";
import { specialtiesQuery } from "@/lib/queries";
import { cairoNow, formatDate, WEEKDAYS } from "@/lib/slots";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "لوحة الطبيب — عيادات النعمة" },
      { name: "description", content: "إدارة الحجوزات والمواعيد." },
      { property: "og:title", content: "لوحة الطبيب" },
      { property: "og:description", content: "إدارة الحجوزات والمواعيد." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = Route.useRouteContext();
  const [tab, setTab] = useState<"bookings" | "schedule" | "profile">("bookings");
  const { data: doctor, isLoading } = useQuery({
    queryKey: ["me", user.id],
    queryFn: async () => (await supabase.from("doctors").select("*").eq("id", user.id).maybeSingle()).data,
  });

  if (isLoading) return <p className="py-20 text-center text-muted-foreground">جاري التحميل…</p>;
  if (!doctor) return <p className="py-20 text-center text-muted-foreground">الحساب ده مش مسجل كطبيب</p>;
  if (doctor.status !== "approved")
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <Clock className="mx-auto size-12 text-primary" />
        <h1 className="mt-4 text-2xl font-bold">{doctor.status === "pending" ? "في انتظار موافقة المالك" : "الحساب موقوف"}</h1>
        <p className="mt-2 text-muted-foreground">هتقدر تستخدم اللوحة بعد الموافقة.</p>
        <Button variant="outline" className="mt-6" onClick={() => supabase.auth.signOut()}>
          خروج
        </Button>
      </div>
    );

  const t = (v: typeof tab, l: string) => (
    <button
      onClick={() => setTab(v)}
      className={`flex-1 rounded-full py-2 text-sm ${tab === v ? "bg-card font-semibold shadow-soft" : "text-muted-foreground"}`}
    >
      {l}
    </button>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">أهلاً د. {doctor.full_name}</h1>
        <div className="flex gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/book/$doctorId" params={{ doctorId: doctor.id }}>صفحتي</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
            خروج
          </Button>
        </div>
      </div>
      <div className="mb-6 flex rounded-full bg-muted p-1">
        {t("bookings", "الحجوزات")}
        {t("schedule", "المواعيد")}
        {t("profile", "بياناتي")}
      </div>
      {tab === "bookings" && <BookingsList doctorId={doctor.id} />}
      {tab === "schedule" && <Schedule doctorId={doctor.id} slotMinutes={doctor.slot_minutes} />}
      {tab === "profile" && <Profile doctor={doctor} />}
    </div>
  );
}

type Row = { weekday: number; start_time: string; end_time: string };

function Schedule({ doctorId, slotMinutes }: { doctorId: string; slotMinutes: number }) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>([]);
  const [slot, setSlot] = useState(slotMinutes);
  const [off, setOff] = useState("");
  const avail = useQuery({
    queryKey: ["avail", doctorId],
    queryFn: async () =>
      (await supabase.from("doctor_availability").select("weekday,start_time,end_time").eq("doctor_id", doctorId)).data ?? [],
  });
  const daysOff = useQuery({
    queryKey: ["off", doctorId],
    queryFn: async () =>
      (await supabase.from("doctor_days_off").select("id,off_date").eq("doctor_id", doctorId).gte("off_date", cairoNow().date).order("off_date"))
        .data ?? [],
  });
  useEffect(() => {
    if (avail.data) setRows(avail.data.map((r) => ({ ...r, start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5) })));
  }, [avail.data]);

  const save = async () => {
    if (rows.some((r) => !r.start_time || !r.end_time || r.end_time <= r.start_time))
      return toast.error("راجع المواعيد: النهاية لازم تكون بعد البداية");
    if (slot < 5 || slot > 180) return toast.error("مدة الكشف من 5 لـ 180 دقيقة");
    const d1 = await supabase.from("doctors").update({ slot_minutes: slot }).eq("id", doctorId);
    const d2 = await supabase.from("doctor_availability").delete().eq("doctor_id", doctorId);
    const d3 = rows.length ? await supabase.from("doctor_availability").insert(rows.map((r) => ({ ...r, doctor_id: doctorId }))) : { error: null };
    if (d1.error || d2.error || d3.error) return toast.error("حصلت مشكلة في الحفظ");
    toast.success("اتحفظت المواعيد");
    qc.invalidateQueries();
  };

  const addOff = async () => {
    if (!off) return;
    const { error } = await supabase.from("doctor_days_off").insert({ doctor_id: doctorId, off_date: off });
    if (error) return toast.error("اليوم ده مضاف قبل كده");
    setOff("");
    daysOff.refetch();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-5">
        <Label>مدة الكشف (دقيقة)</Label>
        <Input type="number" min={5} max={180} className="mt-1.5 max-w-32" value={slot} onChange={(e) => setSlot(Number(e.target.value))} />
      </div>
      <div className="space-y-3 rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">أيام وساعات الشغل</h2>
        {WEEKDAYS.map((name, wd) => (
          <div key={wd} className="flex flex-wrap items-center gap-2 border-b pb-3 last:border-0">
            <span className="w-20 text-sm font-medium">{name}</span>
            {rows.map((r, i) =>
              r.weekday !== wd ? null : (
                <span key={i} className="flex items-center gap-1 rounded-xl bg-muted p-1">
                  <input type="time" className="field h-8 w-28" value={r.start_time}
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, start_time: e.target.value } : x)))} />
                  <span className="text-xs">→</span>
                  <input type="time" className="field h-8 w-28" value={r.end_time}
                    onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, end_time: e.target.value } : x)))} />
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </span>
              ),
            )}
            <Button variant="ghost" size="sm" onClick={() => setRows([...rows, { weekday: wd, start_time: "17:00", end_time: "21:00" }])}>
              <Plus /> فترة
            </Button>
          </div>
        ))}
        <Button onClick={save} className="rounded-full">حفظ المواعيد</Button>
      </div>
      <div className="space-y-3 rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">أيام الإجازة</h2>
        <div className="flex gap-2">
          <input type="date" className="field max-w-48" min={cairoNow().date} value={off} onChange={(e) => setOff(e.target.value)} />
          <Button onClick={addOff}>إضافة</Button>
        </div>
        {daysOff.data?.map((d) => (
          <div key={d.id} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-sm">
            {formatDate(d.off_date)}
            <Button variant="ghost" size="icon" className="size-7"
              onClick={async () => { await supabase.from("doctor_days_off").delete().eq("id", d.id); daysOff.refetch(); }}>
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

type Doc = {
  id: string; full_name: string; title: string; phone: string; specialty_id: string | null; bio: string; fee: number;
  accepts_instapay: boolean; accepts_clinic: boolean;
};

function Profile({ doctor }: { doctor: Doc }) {
  const qc = useQueryClient();
  const { data: specialties = [] } = useQuery(specialtiesQuery);
  const [f, setF] = useState(doctor);
  const save = async () => {
    if (f.full_name.trim().length < 3) return toast.error("اكتب الاسم");
    if (!f.accepts_clinic && !f.accepts_instapay) return toast.error("لازم طريقة دفع واحدة على الأقل");
    const { error } = await supabase.from("doctors").update({
      full_name: f.full_name, title: f.title, phone: f.phone, specialty_id: f.specialty_id, bio: f.bio,
      fee: Math.max(0, Math.round(f.fee)), accepts_instapay: f.accepts_instapay, accepts_clinic: f.accepts_clinic,
    }).eq("id", doctor.id);
    if (error) return toast.error("حصلت مشكلة");
    toast.success("اتحفظ");
    qc.invalidateQueries();
  };
  return (
    <div className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2">
      <div className="space-y-1.5"><Label>الاسم</Label><Input value={f.full_name} maxLength={100} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>اللقب (مثلاً: استشاري)</Label><Input value={f.title} maxLength={100} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>الموبايل</Label><Input dir="ltr" value={f.phone} maxLength={20} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
      <div className="space-y-1.5">
        <Label>التخصص</Label>
        <select className="field" value={f.specialty_id ?? ""} onChange={(e) => setF({ ...f, specialty_id: e.target.value || null })}>
          {specialties.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div className="space-y-1.5"><Label>سعر الكشف (جنيه)</Label><Input type="number" min={0} value={f.fee} onChange={(e) => setF({ ...f, fee: Number(e.target.value) })} /></div>
      <div className="flex flex-col justify-end gap-3">
        <label className="flex items-center justify-between text-sm">الدفع في العيادة <Switch checked={f.accepts_clinic} onCheckedChange={(v) => setF({ ...f, accepts_clinic: v })} /></label>
        <label className="flex items-center justify-between text-sm">إنستا باي <Switch checked={f.accepts_instapay} onCheckedChange={(v) => setF({ ...f, accepts_instapay: v })} /></label>
      </div>
      <div className="space-y-1.5 sm:col-span-2"><Label>نبذة قصيرة</Label><Textarea rows={3} maxLength={1000} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
      <Button onClick={save} className="rounded-full sm:col-span-2">حفظ</Button>
    </div>
  );
}
