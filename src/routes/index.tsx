import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, MapPin, Phone } from "lucide-react";
import hero from "@/assets/hero-clinic.jpg";
import { Button } from "@/components/ui/button";
import { SpecialtyIcon } from "@/components/SpecialtyIcon";
import { specialtiesQuery } from "@/lib/queries";
import { CLINIC } from "@/lib/clinic";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "عيادات النعمة — كل التخصصات في مكان واحد" },
      { name: "description", content: "احجز كشفك أونلاين في عيادات النعمة بالمحلة الكبرى. كل التخصصات." },
      { property: "og:title", content: "عيادات النعمة — كل التخصصات" },
      { property: "og:description", content: "احجز كشفك أونلاين في دقيقة." },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: specialties = [] } = useQuery(specialtiesQuery);
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="relative mt-6 overflow-hidden rounded-3xl">
        <img src={hero} alt="استقبال عيادات النعمة" width={1600} height={912} className="h-[420px] w-full object-cover sm:h-[480px]" />
        <div className="absolute inset-0 bg-gradient-to-l from-background/95 via-background/70 to-background/10" />
        <div className="absolute inset-0 flex flex-col justify-center gap-4 p-6 sm:p-12">
          <h1 className="max-w-md text-4xl font-bold leading-tight sm:text-5xl">صحتك تستاهل راحة</h1>
          <p className="max-w-sm text-muted-foreground">كل التخصصات، واحجز ميعادك في دقيقة.</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="lg" className="rounded-full">
              <Link to="/doctors">
                <CalendarCheck /> احجز الآن
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <a href={`tel:${CLINIC.phone}`}>
                <Phone /> اتصل بنا
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="mb-5 text-2xl font-bold">التخصصات</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {specialties.map((s) => (
            <Link
              key={s.id}
              to="/doctors"
              search={{ specialty: s.id }}
              className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center text-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-soft"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                <SpecialtyIcon name={s.icon} className="size-5" />
              </span>
              {s.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-12 flex flex-col items-start gap-2 rounded-2xl bg-secondary p-6 text-secondary-foreground sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-center gap-2">
          <MapPin className="size-5 text-primary" /> {CLINIC.address}
        </span>
        <a href={`tel:${CLINIC.phone}`} dir="ltr" className="font-semibold">
          {CLINIC.phone}
        </a>
      </section>
    </div>
  );
}
