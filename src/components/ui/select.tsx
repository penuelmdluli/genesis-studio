import { cn } from "@/lib/utils";
import { SelectHTMLAttributes, forwardRef } from "react";

const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all duration-200 hover:border-white/[0.12] appearance-none cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

export { Select };
