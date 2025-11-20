import { cn } from "@renderer/utils/cn";
import { Shortcut } from "@renderer/utils/shortcut";
import { Fragment } from "react/jsx-runtime";

export function ShortcutKey({
  children,
  className,
  ...props
}: { children: string } & Omit<React.HTMLAttributes<HTMLDivElement>, "children">) {
  return (
    <div
      className={cn("p-1 rounded-lg bg-muted text-xs min-w-8 border shadow-inner text-center", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function ShortcutCombination({
  shortcuts,
  className,
  renderShortcut,
  ...props
}: { shortcuts: string[]; renderShortcut?: (key: string) => React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("inline-flex items-center gap-1", className)} {...props}>
      {shortcuts.map((key) => (
        <Fragment key={key}>
          {renderShortcut ? renderShortcut(key) : <ShortcutKey>{Shortcut.keyToIcon(key)}</ShortcutKey>}
        </Fragment>
      ))}
    </div>
  );
}
