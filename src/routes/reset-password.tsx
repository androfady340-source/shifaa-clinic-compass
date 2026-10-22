import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "كلمة سر جديدة — عيادات النعمة" },
      { name: "description", content: "تغيير كلمة السر." },
      { property: "og:title", content: "كلمة سر جديدة" },
      { property: "og:description", content: "تغيير كلمة السر." },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const [pw, setPw] = useState("");
  const navigate = useNavigate();
  const save = async () => {
    if (pw.length < 8) return toast.error("8 حروف على الأقل");
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.error("اللينك انتهى، اطلب لينك جديد");
    toast.success("تم التغيير");
    navigate({ to: "/dashboard" });
  };
  return (
    <div className="mx-auto max-w-md space-y-4 px-4 py-14">
      <h1 className="text-2xl font-bold">كلمة سر جديدة</h1>
      <Label>كلمة السر</Label>
      <Input dir="ltr" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
      <Button className="w-full rounded-full" onClick={save}>
        حفظ
      </Button>
    </div>
  );
}
