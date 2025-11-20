import { cn } from "@renderer/utils/cn";

export function NoDraggableWrapper({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("no-drag", className)} {...rest}>
      {children}
    </div>
  );
}
