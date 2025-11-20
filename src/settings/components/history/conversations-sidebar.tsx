import { cn } from "@renderer/utils/cn";

export function ConversationsSidebar({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("h-screen bg-background border-r flex flex-col", className)} {...rest} />;
}

export function ConversationSidebarHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <header className={cn("py-3 border-b", className)} {...rest} />;
}

export function ConversationSidebarBody({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col grow overflow-y-auto scrollbar-custom", className)} {...rest} />;
}

export function ConversationSidebarFooter({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-3 py-2 border-t", className)} {...rest} />;
}
