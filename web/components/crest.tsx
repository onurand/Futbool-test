import { cn } from "@/lib/cn";

export function Crest({
  label,
  className,
  size = "md",
  style,
}: {
  label: string;
  className?: string;
  size?: "sm" | "md" | "lg";
  style?: React.CSSProperties;
}) {
  const sizes = {
    sm: "h-7 w-7 text-[11px] rounded-md",
    md: "h-12 w-12 text-sm rounded-xl",
    lg: "h-16 w-16 text-xl rounded-2xl",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-extrabold tracking-tight",
        sizes[size],
        className
      )}
      style={style}
    >
      {label}
    </span>
  );
}
