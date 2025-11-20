import { cn } from "@renderer/utils/cn";
import { Card, CardContent, CardHeader } from "@renderer/components/card";
import { MCPServerState } from "@renderer/hooks/useNewState";

export function PersonaCard({
  className,
  isActive,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { isActive: boolean }) {
  return (
    <Card
      className={cn(
        "flex flex-row rounded-2xl border cursor-pointer",
        {
          "border-primary/80 dark:border-primary/30": isActive,
          "border-transparent": !isActive,
        },
        className,
      )}
      {...props}
    />
  );
}

export function PersonaCardHeader({ className, ...props }: React.ComponentProps<typeof CardHeader>) {
  return (
    <CardHeader
      className={cn("w-fit p-3 flex flex-row gap-2 space-y-0 items-center basis-2/3", className)}
      {...props}
    />
  );
}

export function PersonaCardIcon({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "w-10 text-primary h-10 bg-background-surface-high rounded-xl flex items-center justify-center [&_svg]:size-4 shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export function PersonaCardHeaderContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col grow", className)} {...props} />;
}

export function PersonaCardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h4 className={cn("text-[13px] font-bold", className)} {...props}>
      {children}
    </h4>
  );
}

export function PersonaCardDescription({ className, children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)} {...props}>
      {children}
    </p>
  );
}

export function PersonaCardDetails({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center text-muted-foreground [&_svg]:size-3 text-[11px] divide-x", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function PersonaCardDetail({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <p
      className={cn("text-xs text-muted-foreground max-w-[250px] truncate pr-2 pl-2 first:pl-0", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function PersonaCardContent({ className, ...props }: React.ComponentProps<typeof CardContent>) {
  return (
    <CardContent
      className={cn("p-3 grow flex flex-row gap-3 justify-end space-y-0 items-center basis-1/3", className)}
      {...props}
    />
  );
}

export function PersonaCardTransitionState({
  className,
  state,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { state: MCPServerState }) {
  return (
    <div
      className={cn(
        "text-xs text-muted-foreground flex items-center gap-1 text-[10px]",
        {
          "text-blue-500": state === "Starting" || state === "Stopping",
          "text-destructive [&_svg]:size-3": state === "Error",
          hidden: state === "Disabled" || state === "Enabled",
        },
        className,
      )}
      {...props}
    />
  );
}
