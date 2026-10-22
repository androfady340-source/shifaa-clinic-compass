import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { specialtiesQuery } from "@/lib/queries";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "دخول الأطباء — عيادات النعمة" },
      { name: "description", content: "دخول وتسجيل الأطباء في عيادات النعمة." },
      { property: "og:title", content: "دخول الأطباء — عيادات النعمة" },
      { property: "og:description", content: "دخول وتسجيل الأطباء." },
    ],
  }),
  component: AuthPage,
});

const signupSchema = z.object({
  full_name: z.string().trim().min(3, "اكتب الاسم بالكامل").max(100),
  phone: z.string().trim().regex(/^\+?[0-9]{8,15}$/, "رقم الموبايل غير صحيح"),
  specialty_id: z.string().uuid("اختار التخصص"),
  email: z.string().trim().email("الإيميل غير صحيح").max(255),
  password: z.string().min(8, "كلمة السر 8 حروف على الأقل").max(72),
});

function AuthPage() {
  const [mode, setMode] = useState<"in" | "up" | "forgot">("in");
  const [f, setF] = useState({ full_name: "", phone: "", specialty_id: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const navigate = useNavigate();
  const { data: specialties = [] } = useQuery(specialtiesQuery);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email: f.email.trim(), password: f.password });
        if (error) return toast.error("الإيميل أو كلمة السر غلط");
        navigate({ to: "/dashboard" });
      } else if (mode === "forgot") {
        await supabase.auth.resetPasswordForEmail(f.email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
        setSent("بعتنالك لينك تغيير كلمة السر على الإيميل.");
      } else {
        const p = signupSchema.safeParse(f);
        if (!p.success) return toast.error(p.error.issues[0].message);
        const { error } = await supabase.auth.signUp({
          email: p.data.email,
          password: p.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: p.data.full_name, phone: p.data.phone, specialty_id: p.data.specialty_id },
          },
        });
        if (error) return toast.error(error.message.includes("registered") ? "الإيميل مسجل قبل كده" : "حصلت مشكلة");
        setSent("افتح الإيميل وأكد حسابك، وبعدها المالك هيوافق عليك.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (sent) return <p className="mx-auto max-w-md px-4 py-20 text-center">{sent}</p>;

  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <div className="mb-6 grid grid-cols-2 rounded-full bg-muted p-1 text-sm">
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-full py-2 ${mode === m ? "bg-card font-semibold shadow-soft" : "text-muted-foreground"}`}
          >
            {m === "in" ? "دخول" : "تسجيل طبيب جديد"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5">
        {mode === "up" && (
          <>
            <div className="space-y-1.5">
              <Label>الاسم بالكامل</Label>
              <Input value={f.full_name} onChange={set("full_name")} maxLength={100} />
            </div>
            <div className="space-y-1.5">
              <Label>الموبايل</Label>
              <Input dir="ltr" value={f.phone} onChange={set("phone")} maxLength={16} />
            </div>
            <div className="space-y-1.5">
              <Label>التخصص</Label>
              <select className="field" value={f.specialty_id} onChange={set("specialty_id")}>
                <option value="">اختار…</option>
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
        <div className="space-y-1.5">
          <Label>الإيميل</Label>
          <Input dir="ltr" type="email" value={f.email} onChange={set("email")} />
        </div>
        {mode !== "forgot" && (
          <div className="space-y-1.5">
            <Label>كلمة السر</Label>
            <Input dir="ltr" type="password" value={f.password} onChange={set("password")} />
          </div>
        )}
        <Button className="w-full rounded-full" disabled={busy}>
          {mode === "in" ? "دخول" : mode === "up" ? "تسجيل" : "ابعت اللينك"}
        </Button>
        {mode === "in" && (
          <button type="button" onClick={() => setMode("forgot")} className="w-full text-sm text-muted-foreground">
            نسيت كلمة السر؟
          </button>
        )}
      </form>
    </div>
  );
}
