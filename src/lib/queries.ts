import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const specialtiesQuery = queryOptions({
  queryKey: ["specialties"],
  queryFn: async () => {
    const { data, error } = await supabase.from("specialties").select("*").order("sort");
    if (error) throw error;
    return data;
  },
});

export const approvedDoctorsQuery = queryOptions({
  queryKey: ["doctors", "approved"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("doctors")
      .select("id, full_name, title, fee, bio, specialty_id, specialties(name, icon)")
      .eq("status", "approved")
      .order("full_name");
    if (error) throw error;
    return data;
  },
});

export const doctorQuery = (id: string) =>
  queryOptions({
    queryKey: ["doctor", id],
    queryFn: async () => {
      const [d, a, o] = await Promise.all([
        supabase.from("doctors").select("*, specialties(name, icon)").eq("id", id).eq("status", "approved").maybeSingle(),
        supabase.from("doctor_availability").select("weekday, start_time, end_time").eq("doctor_id", id),
        supabase.from("doctor_days_off").select("off_date").eq("doctor_id", id),
      ]);
      if (d.error) throw d.error;
      return { doctor: d.data, availability: a.data ?? [], daysOff: (o.data ?? []).map((x) => x.off_date) };
    },
  });
