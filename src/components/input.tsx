import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@renderer/utils/cn";
import { Search, X } from "lucide-react";
import { Button } from "./button";
import { useRef } from "react";

const inputVariants = cva(
  "flex w-full rounded-full border text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/50 placeholder:text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
  {
    variants: {
      variant: {
        default: "border-input bg-background",
        secondary: "bg-background-surface border-background-surface",
      },
      size: {
        default: "h-10 px-3 py-2 ",
        sm: "h-9 px-3 py-2",
      },
    },
    defaultVariants: {
      size: "default",
      variant: "default",
    },
  },
);

type InputProps = Omit<React.ComponentProps<"input">, "size"> & VariantProps<typeof inputVariants>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size = "default", variant = "default", ...props }, ref) => {
    return <input type={type} className={cn(inputVariants({ className, size, variant }))} ref={ref} {...props} />;
  },
);
Input.displayName = "Input";

export { Input };

const searchInputVariants = cva(
  "relative w-full [&_svg]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:absolute group",
  {
    variants: {
      size: {
        default: "[&_svg]:size-4",
        sm: "[&_svg]:size-3.5",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

export function SearchInput({
  className,
  size = "default",
  wrapperClassName,
  onChange,
  onClear,
  ...props
}: InputProps & { wrapperClassName?: string; onClear?: () => void }) {
  const ref = useRef<HTMLInputElement>(null);

  const clear = () => {
    onClear?.();

    if (!ref.current) return;

    ref.current.focus();
    ref.current.value = "";
  };

  return (
    <div className={cn(searchInputVariants({ size }), wrapperClassName)}>
      <Search className="left-3 top-1/2 -translate-y-1/2" />

      <Input
        ref={mergeRefs([ref, props.ref as React.Ref<HTMLInputElement>])}
        type="text"
        className={cn("pl-9 pr-8 w-full peer", className)}
        size={size}
        onChange={onChange}
        {...props}
      />

      <Button
        onClick={clear}
        variant="ghost"
        size="icon"
        type="button"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5.5 h-5.5 [&_svg]:size-3 opacity-0 pointer-events-none transition-all group-hover:opacity-100 group-hover:pointer-events-auto peer-focus:opacity-100 peer-focus:pointer-events-auto"
      >
        <X />
      </Button>
    </div>
  );
}

function mergeRefs<T>(refs: React.Ref<T>[]) {
  return (value: T) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref) {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    });
  };
}
