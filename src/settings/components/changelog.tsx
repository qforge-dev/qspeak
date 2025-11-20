import { ItemsList } from "@renderer/components/items-list";
import { cn } from "@renderer/utils/cn";
import { useMemo, useState } from "react";

export function ChangelogWrapper({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-4 divide-y max-h-[300px] overflow-y-auto px-4", className)} {...rest} />;
}

export function Changelog({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <article className={cn("", className)} {...rest} />;
}

export function ChangelogHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <header className={cn("flex items-center gap-2 mb-1", className)} {...rest} />;
}

export function ChangelogVersion({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <h4 className={cn("text-lg font-semibold text-foreground", className)} {...rest} />;
}

export function ChangelogDate({ className, ...rest }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...rest} />;
}

export function ChangelogList({
  className,
  items,
  ...rest
}: React.HTMLAttributes<HTMLUListElement> & { items: string[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const withIds = useMemo(() => items.map((item, index) => ({ id: index, content: item })), [items]);

  const showExpanded = items.length > 5;

  const toggleExpanded = () => {
    setIsOpen((prev) => !prev);
  };

  const visibleItems = isOpen ? withIds : withIds.slice(0, 5);

  return (
    <div className="w-full">
      <ItemsList
        className={cn("", className)}
        items={visibleItems}
        renderItem={(item) => <ChangelogItem key={item.id}>- {item.content}</ChangelogItem>}
        {...rest}
      />

      <div className={cn("flex items-center justify-center mt-2", { hidden: !showExpanded })}>
        <button
          onClick={toggleExpanded}
          className="bg-transparent text-xs text-foreground/40 border-none hover:text-foreground/80 transition-colors"
        >
          {isOpen ? "Show less" : "Show all"}
        </button>
      </div>
    </div>
  );
}

export function ChangelogItem({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm list-disc list-inside text-foreground/80", className)} {...rest} />;
}
