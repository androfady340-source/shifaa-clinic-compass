import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookingsList } from "@/components/BookingsList";
import { specialtiesQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "لوحة المالك — عيادات النعمة" },
      { name: "description", content: "الموافقة على الأطباء ومتابعة الحجوزات." },
      { property: "og:title", content: "لوحة المالك" },
      { property: "og:description", content: "إدارة العيادة." },
    ],
  }),
  component: Admin,
});

const STATUS = { pending: "في الانتظار", approved: "معتمد", rejected: "موقوف" } as const;

function Admin() {
  const { isAdmin, ready } = useAuth();
  const [tab, setTab] = useState<"doctors" | "bookings" | "specialties">("doctors");
  if (!ready) return <p className="py-20 text-center text-muted-foreground">جاري التحميل…</p>;
  if (!isAdmin) return <p className="py-20 text-center text-muted-foreground">الصفحة دي للمالك بس</p>;
  const t = (v: typeof tab, l: string) => (
    <button onClick={() => setTab(v)} className={`flex-1 rounded-full py-2 text-sm ${tab === v ? "bg-card font-semibold shadow-soft" : "text-muted-foreground"}`}>{l}</button>
  );
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">لوحة المالك</h1>
      <div className="mb-6 flex rounded-full bg-muted p-1">
        {t("doctors", "الأطباء")}
        {t("bookings", "كل الحجوزات")}
        {t("specialties", "التخصصات")}
      </div>
      {tab === "doctors" && <Doctors />}
      {tab === "bookings" && <BookingsList showDoctor />}
      {tab === "specialties" && <Specialties />}
    </div>
  );
}

function Doctors() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["admin-doctors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doctors")
        .select("*, specialties(name)")
        .order("status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const set = async (id: string, status: "approved" | "rejected" | "pending") => {
    const { error } = await supabase.from("doctors").update({ status }).eq("id", id);
    if (error) return toast.error("حصلت مشكلة");
    toast.success(STATUS[status]);
    qc.invalidateQueries();
  };
  if (!data.length) return <p className="py-8 text-center text-muted-foreground">مفيش أطباء</p>;
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-4">
          <div>
            <p className="font-semibold">د. {d.full_name}</p>
            <p className="text-sm text-muted-foreground">
              {d.specialties?.name ?? "—"} · <span dir="ltr">{d.phone}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={d.status === "approved" ? "confirmed" : d.status === "pending" ? "pending" : "cancelled"}>{STATUS[d.status]}</Badge>
            {d.status !== "approved" && <Button size="sm" onClick={() => set(d.id, "approved")}>موافقة</Button>}
            {d.status !== "rejected" && <Button size="sm" variant="outline" onClick={() => set(d.id, "rejected")}>{d.status === "pending" ? "رفض" : "إيقاف"}</Button>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Specialties() {
  const qc = useQueryClient();
  const { data = [] } = useQuery(specialtiesQuery);
  const [name, setName] = useState("");
  const add = async () => {
    const n = name.trim();
    if (n.length < 2 || n.length > 50) return toast.error("اكتب اسم التخصص");
    const { error } = await supabase.from("specialties").insert({ name: n });
    if (error) return toast.error("موجود قبل كده");
    setName("");
    qc.invalidateQueries({ queryKey: ["specialties"] });
  };
  const del = async (id: string) => {
    if (!confirm("مسح التخصص؟")) return;
    const { error } = await supabase.from("specialties").delete().eq("id", id);
    if (error) return toast.error("حصلت مشكلة في مسح التخصص");
    qc.invalidateQueries({ queryKey: ["specialties"] });
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="تخصص جديد" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
        <Button onClick={add}>إضافة</Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {data.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border bg-card px-4 py-2">
            {s.name}
            <Button variant="ghost" size="icon" onClick={() => del(s.id)}><Trash2 /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
