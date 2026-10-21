import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpecialtyIcon } from "@/components/SpecialtyIcon";
import { approvedDoctorsQuery, specialtiesQuery } from "@/lib/queries";

export const Route = createFileRoute("/doctors")({
  validateSearch: z.object({ specialty: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "الأطباء — عيادات النعمة" },
      { name: "description", content: "اختار الطبيب والتخصص واحجز ميعادك." },
      { property: "og:title", content: "أطباء عيادات النعمة" },
      { property: "og:description", content: "اختار الطبيب واحجز ميعادك." },
    ],
  }),
  component: DoctorsPage,
});

function DoctorsPage() {
  const { specialty } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: specialties = [] } = useQuery(specialtiesQuery);
  const { data: doctors = [], isLoading } = useQuery(approvedDoctorsQuery);
  const list = specialty ? doctors.filter((d) => d.specialty_id === specialty) : doctors;

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold">الأطباء</h1>
      <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
        <button className={chip(!specialty)} onClick={() => navigate({ search: {} })}>
          الكل
        </button>
        {specialties.map((s) => (
          <button key={s.id} className={chip(specialty === s.id)} onClick={() => navigate({ search: { specialty: s.id } })}>
            {s.name}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="mt-10 text-center text-muted-foreground">جاري التحميل…</p>
      ) : list.length === 0 ? (
        <p className="mt-10 text-center text-muted-foreground">مفيش أطباء في التخصص ده حالياً</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((d) => (
            <div key={d.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-soft">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-full bg-primary-soft text-primary">
                  <UserRound className="size-6" />
                </span>
                <div>
                  <h3 className="font-semibold">د. {d.full_name}</h3>
                  <p className="flex items-center gap-1 text-sm text-muted-foreground">
                    <SpecialtyIcon name={d.specialties?.icon} className="size-3.5" />
                    {d.specialties?.name ?? "—"} {d.title && `· ${d.title}`}
                  </p>
                </div>
              </div>
              {d.bio && <p className="line-clamp-2 text-sm text-muted-foreground">{d.bio}</p>}
              <div className="mt-auto flex items-center justify-between">
                <span className="text-sm">
                  الكشف <b>{d.fee}</b> ج
                </span>
                <Button asChild className="rounded-full">
                  <Link to="/book/$doctorId" params={{ doctorId: d.id }}>
                    احجز
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
