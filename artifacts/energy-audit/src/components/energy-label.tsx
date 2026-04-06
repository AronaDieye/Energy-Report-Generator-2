import React from "react";

interface EnergyLabelProps {
  label: string | null | undefined;
  className?: string;
}

const labelColors: Record<string, string> = {
  A: "bg-[#009640] text-white",
  B: "bg-[#52B153] text-white",
  C: "bg-[#78C359] text-white",
  D: "bg-[#FFE600] text-black",
  E: "bg-[#F39200] text-white",
  F: "bg-[#E30613] text-white",
  G: "bg-[#E30613] text-white",
};

export function EnergyLabel({ label, className = "" }: EnergyLabelProps) {
  if (!label) return <span className="text-muted-foreground">—</span>;

  const normalizedLabel = label.toUpperCase().trim()[0];
  const colorClass = labelColors[normalizedLabel] || "bg-muted text-muted-foreground";

  return (
    <div className={`inline-flex items-center justify-center font-bold text-xl rounded-sm w-10 h-10 ${colorClass} ${className}`}>
      {normalizedLabel}
    </div>
  );
}
