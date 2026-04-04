import { cn } from "@/lib/utils";
import { forwardRef } from "react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value?: string;
  onChange?: (value: string) => void;
  options?: SelectOption[];
  className?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  children?: React.ReactNode;
  placeholder?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, options, onChange, value, placeholder, ...props }, ref) => (
    <select
      ref={ref}
      value={value}
      className={cn(
        "w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40 transition-all duration-200 hover:border-white/[0.12] appearance-none cursor-pointer",
        className
      )}
      onChange={(e) => onChange?.(e.target.value)}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options
        ? options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))
        : children}
    </select>
  )
);
Select.displayName = "Select";

export { Select };
export type { SelectOption, SelectProps };
