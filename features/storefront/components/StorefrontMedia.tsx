import Image from "next/image";
import type { StorefrontMenuItem } from "@/features/storefront/lib/data/menu";

type Props = {
  item: Pick<StorefrontMenuItem, "imageUrl" | "primaryImageUrl" | "name">;
  className?: string;
  imageClassName?: string;
  emphasize?: boolean;
  eager?: boolean;
};

export function StorefrontMedia({
  item,
  className = "",
  imageClassName = "",
  emphasize = false,
  eager = false,
}: Props) {
  const source = item.primaryImageUrl || item.imageUrl;

  if (source) {
    return (
      <div
        className={`relative overflow-hidden bg-[var(--sf-paper-inset)] ${className}`}
        style={{ position: "relative", minHeight: "1px" }}
      >
        <Image
          src={source}
          alt={item.name}
          fill
          sizes="(min-width: 1024px) 42vw, 100vw"
          className={`object-cover ${imageClassName}`}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          unoptimized
        />
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-[linear-gradient(165deg,var(--sf-paper-inset),var(--sf-paper-raised))] ${className}`}
      style={{ position: "relative", minHeight: "1px" }}
      role="img"
      aria-label={`${item.name} — house illustration`}
    >
      <div className="absolute inset-0 opacity-40 [background:repeating-linear-gradient(90deg,transparent,transparent_11px,color-mix(in_oklch,var(--sf-rule)_35%,transparent)_11px,color-mix(in_oklch,var(--sf-rule)_35%,transparent)_12px)]" />
      <div className="absolute left-[14%] top-[18%] h-[42%] w-[34%] border border-[var(--sf-rule-strong)] bg-[color-mix(in_oklch,var(--sf-accent)_22%,var(--sf-paper-inset))]" />
      <div className="absolute bottom-[16%] right-[12%] h-[28%] w-[38%] border border-[var(--sf-rule-strong)] bg-[var(--sf-paper)]" />
      <div
        className={`absolute bottom-[22%] left-[22%] h-[10%] w-[48%] rounded-full bg-[color-mix(in_oklch,var(--sf-ink)_14%,transparent)] blur-md ${emphasize ? "opacity-80" : "opacity-50"}`}
      />
      <p className="absolute left-4 top-4 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[var(--sf-ink-faint)]">
        House illustration
      </p>
    </div>
  );
}
