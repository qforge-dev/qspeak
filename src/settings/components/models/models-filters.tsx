import { HTMLAttributes } from "react";

export function ModelsFiltersWrapper({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="flex gap-2 justify-between items-center" {...props}>
      {children}
    </div>
  );
}

export function ModelsFilters({ children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="flex gap-1" {...props}>
      {children}
    </div>
  );
}
