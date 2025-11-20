import { cn } from "@renderer/utils/cn";

export function HistoryWrapper({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("h-full relative grid grid-cols-[250px_1fr]", className)} {...rest} />;
}

export function HistoryMain({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <main className={cn("h-full w-full flex flex-col h-screen", className)} {...rest} />;
}

export function HistoryConversationContent({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 grow", className)} {...rest} />;
}

export function HistoryHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <header
      data-tauri-drag-region
      className={cn("py-4 px-6 bg-transparent user-select-none cursor-grab", className)}
      {...rest}
    />
  );
}

export function HistoryHeading({ className, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h1 data-tauri-drag-region className={cn("text-base font-semibold", className)} {...rest} />;
}
