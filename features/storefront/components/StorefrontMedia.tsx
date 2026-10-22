import Image from "next/image";
import type { StorefrontMenuItem } from "@/features/storefront/lib/data/menu";

type Props = {
  item: Pick<StorefrontMenuItem, "imageUrl" | "primaryImageUrl" | "name">;
  className?: string;
  imageClassName?: string;
  emphasize?: boolean;
  eager?: boolean;
  sizes?: string;
};

export function StorefrontMedia({
  item,
  className = "",
  imageClassName = "",
  emphasize = false,
  eager = false,
  sizes = "(min-width: 1024px) 42vw, 100vw",
}: Props) {
  const source = item.primaryImageUrl || item.imageUrl;

  if (source) {
    return (
      <div className={`relative overflow-hidden bg-[var(--sf-inset)] ${className}`} style={{ position: "relative", minHeight: "1px" }}>
        <Image
          src={source}
          alt={item.name}
          fill
          sizes={sizes}
          className={`object-cover ${imageClassName}`}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          unoptimized
        />
      </div>
    );
  }

  // No photo: a tinted tile with the item's initial, never a placeholder label.
  return (
    <div
      className={`relative grid place-items-center overflow-hidden bg-[radial-gradient(120%_90%_at_30%_20%,var(--sf-accent-soft),var(--sf-inset-strong))] ${className}`}
      style={{ position: "relative", minHeight: "1px" }}
      role="img"
      aria-label={item.name}
    >
      <span
        aria-hidden="true"
        className={`sf-display select-none text-[var(--sf-accent)] ${emphasize ? "text-[clamp(4rem,14vw,8rem)] opacity-70" : "text-[2.25rem] opacity-60"}`}
      >
        {item.name.trim().charAt(0).toUpperCase()}
      </span>
    </div>
  );
}
