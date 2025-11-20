import { BasicLinkProps, BasicLink } from "@renderer/components/basic-link";
import { cn } from "@renderer/utils/cn";
import { HTMLAttributes } from "react";

export function Layout({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("grid grid-cols-[200px_1fr] bg-background rounded-xl overflow-hidden", className)} {...rest}>
      {children}
    </div>
  );
}

export function Main({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <main className={cn("bg-background h-full", className)} {...rest}>
      {children}
    </main>
  );
}

export function RouteWrapper({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 flex flex-col gap-6 overflow-y-auto h-full scrollbar-custom", className)} {...rest} />;
}

export function SidebarNav({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <nav className={cn("grow flex flex-col", className)} {...rest} />;
}

export function SidebarNavList({ className, ...rest }: React.HTMLAttributes<HTMLUListElement>) {
  return <ul className={cn("flex flex-col gap-0 pb-6 py-2 px-2", className)} {...rest} />;
}

export function SidebarNavItem({ className, ...rest }: React.HTMLAttributes<HTMLLIElement>) {
  return <li className={cn("", className)} {...rest} />;
}

export function NavLink({ className, ...rest }: BasicLinkProps) {
  return (
    <BasicLink
      className={({ isActive }: { isActive: boolean }) =>
        cn(
          "inline-flex items-center justify-start w-full h-9 rounded-full px-3 text-[13px] font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gap-2",
          isActive ? "bg-primary text-primary-foreground" : "hover:bg-background-surface-high hover:text-foreground",
          className,
        )
      }
      {...rest}
    />
  );
}

export function OptionWrapper({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex justify-between items-center py-3 first:pt-0 last:pb-0", className)} {...rest} />;
}

export function OptionTitle({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <h4 className={cn("text-xs font-medium", className)} {...rest} />;
}

export function OptionDescription({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <p className={cn("text-[13px] text-foreground/70", className)} {...rest} />;
}

export function OptionContent({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-0.5", className)} {...rest} />;
}

export function OptionIcon({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "w-6.5 h-6.5 [&>svg]:size-3.5 bg-background-surface-highest text-foreground rounded-lg flex items-center justify-center",
        className,
      )}
      {...rest}
    />
  );
}
