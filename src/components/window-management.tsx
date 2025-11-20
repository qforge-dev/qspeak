import { ButtonProps } from "./button";
import { cn } from "@renderer/utils/cn";
import { Button } from "./button";

export function WindowActionsButton({ children, className, ...rest }: ButtonProps) {
  return (
    <Button
      className={cn(
        "w-3.5 h-3.5 [&>svg]:size-2.5 p-0 pointer-events-auto rounded-full hover:opacity-80 transition-all duration-100",
        className,
      )}
      {...rest}
    >
      {children}
    </Button>
  );
}

export function WindowCloseButton({ className, ...rest }: ButtonProps) {
  return (
    <WindowActionsButton
      variant="destructive"
      className={cn("bg-red-500 hover:bg-red-500 hover:opacity-80", className)}
      {...rest}
    />
  );
}

export function WindowMinimizeButton({ className, ...rest }: ButtonProps) {
  return (
    <WindowActionsButton
      className={cn("bg-orange-300 hover:bg-orange-300 hover:opacity-80 border-orange-300", className)}
      {...rest}
    />
  );
}
