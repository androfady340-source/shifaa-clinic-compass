import {
  Apple, Baby, Bone, Brain, BrainCircuit, Droplet, Ear, Eye, Heart, HeartPulse, Scissors, Smile, Sparkles, Stethoscope,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  apple: Apple, baby: Baby, bone: Bone, brain: Brain, "brain-circuit": BrainCircuit, droplet: Droplet, ear: Ear,
  eye: Eye, heart: Heart, "heart-pulse": HeartPulse, scissors: Scissors, smile: Smile, sparkles: Sparkles,
  stethoscope: Stethoscope,
};

export const ICON_KEYS = Object.keys(MAP);

export function SpecialtyIcon({ name, className }: { name?: string | null | undefined; className?: string }) {
  const Icon = MAP[name ?? ""] ?? Stethoscope;
  return <Icon className={className} />;
}
