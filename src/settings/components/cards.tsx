import { cn } from "@renderer/utils/cn";
import {
  Card as BaseCard,
  CardContent as BaseCardContent,
  CardHeader as BaseCardHeader,
  CardTitle as BaseCardTitle,
  CardFooter as BaseCardFooter,
} from "@renderer/components/card";

export function SettingsCard({ className, ...props }: React.ComponentProps<typeof BaseCard>) {
  return <BaseCard className={cn("", className)} {...props} />;
}

export function SettingsCardHeader({ className, ...props }: React.ComponentProps<typeof BaseCardHeader>) {
  return <BaseCardHeader className={cn("", className)} {...props} />;
}

export function SettingsCardContent({ className, ...props }: React.ComponentProps<typeof BaseCardContent>) {
  return <BaseCardContent className={cn("divide-y", className)} {...props} />;
}

export function SettingsCardTitle({ className, ...props }: React.ComponentProps<typeof BaseCardTitle>) {
  return <BaseCardTitle className={cn("text-sm font-semibold", className)} {...props} />;
}

export function SettingsCardFooter({ className, ...props }: React.ComponentProps<typeof BaseCardFooter>) {
  return <BaseCardFooter className={cn("", className)} {...props} />;
}

export function ProvidersCard({ className, ...props }: React.ComponentProps<typeof BaseCard>) {
  return <BaseCard className={cn("", className)} {...props} />;
}

export function ProvidersCardHeader({ className, ...props }: React.ComponentProps<typeof BaseCardHeader>) {
  return <BaseCardHeader className={cn("", className)} {...props} />;
}

export function ProvidersCardContent({ className, ...props }: React.ComponentProps<typeof BaseCardContent>) {
  return <BaseCardContent className={cn("divide-y", className)} {...props} />;
}

export function ProvidersCardTitle({ className, ...props }: React.ComponentProps<typeof BaseCardTitle>) {
  return <BaseCardTitle className={cn("", className)} {...props} />;
}

export function ModelsCard({
  className,
  isActive,
  isDownloaded,
  ...props
}: React.ComponentProps<typeof BaseCard> & { isActive: boolean; isDownloaded: boolean }) {
  return (
    <BaseCard
      className={cn(
        "flex flex-row rounded-2xl border",
        {
          "border-primary/80 dark:border-primary/30": isActive,
          "border-transparent": !isActive,
          "cursor-pointer": isDownloaded,
        },
        className,
      )}
      {...props}
    />
  );
}

export function ModelsCardIcon({
  className,
  isLocal,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { isLocal: boolean }) {
  return (
    <div
      className={cn(
        "w-10 h-10 bg-background-surface-high rounded-xl flex items-center justify-center [&_svg]:size-4 shrink-0",
        {
          "text-blue-500": !isLocal,
          "text-primary": isLocal,
        },
        className,
      )}
      {...props}
    />
  );
}

export function ModelsCardHeader({ className, ...props }: React.ComponentProps<typeof BaseCardHeader>) {
  return <BaseCardHeader className={cn("w-fit p-3 flex flex-row gap-2 space-y-0", className)} {...props} />;
}

export function ModelsCardHeaderContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col", className)} {...props} />;
}

export function ModelsCardDetailsWrapper({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-row justify-end items-center h-full gap-3", className)} {...props} />;
}

export function ModelsCardDetails({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex gap-1 items-center text-muted-foreground [&_svg]:size-3 text-[11px]", className)}
      {...props}
    />
  );
}

export function ModelsCardContent({ className, ...props }: React.ComponentProps<typeof BaseCardContent>) {
  return (
    <BaseCardContent
      className={cn("p-3 grow flex flex-row gap-3 justify-end space-y-0 items-center", className)}
      {...props}
    />
  );
}

export function ModelsCardTitle({ className, ...props }: React.ComponentProps<typeof BaseCardTitle>) {
  return <BaseCardTitle className={cn("", className)} {...props} />;
}
