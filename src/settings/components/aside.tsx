import { cn } from "@renderer/utils/cn";

export function Aside({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <aside className={cn("sticky top-0 left-0 h-screen flex flex-col bg-background-surface", className)} {...rest}>
      {children}
    </aside>
  );
}
