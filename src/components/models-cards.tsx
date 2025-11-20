import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@renderer/components/alert-dialog";
import { Label } from "@renderer/components/label";
import { RadioGroupItem, RadioGroupItemProps } from "@renderer/components/radio-group";
import { DownloadStateStatus } from "@renderer/hooks/useModelsState";
import { cn } from "@renderer/utils/cn";
import { ArrowDown, Loader, Minus } from "lucide-react";
import { Button } from "./button";

export function ModelRadioItem({ className, children, ...rest }: RadioGroupItemProps) {
  return (
    <Label className={cn("relative w-full block text-sm cursor-pointer")}>
      <RadioGroupItem className={cn("absolute left-3 top-3.5 peer")} {...rest} />
      <div
        className={cn(
          "peer-data-[state=checked]:bg-muted/30 border border-muted/80 w-full pl-9 pr-4 py-3 flex rounded-md peer-data-[state=checked]:checked flex flex-col items-start text-left",
          className,
        )}
      >
        {children}
      </div>
    </Label>
  );
}

export function ModelItem({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-muted/20 text-sm rounded-md border border-muted/80 text-sm w-full px-4 py-3 flex rounded-mdflex flex-col items-start text-left",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function ModelRadioItemHeading({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h4 className={cn("text-[13px] font-bold", className)} {...props}>
      {children}
    </h4>
  );
}

export function ModelRadioItemDescription({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)} {...props}>
      {children}
    </p>
  );
}

export function ShortcutWrapper({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <kbd className={cn("block bg-accent/50 text-foreground text-xs rounded-sm px-2 py-1", className)} {...props} />
  );
}

export function ScaleIndicator({ value, className }: { value: number; className?: string }) {
  const maxValue = 5;
  const cells = Array.from({ length: maxValue }, (_, i) => i + 1);

  return (
    <div className={cn("flex gap-1", className)}>
      {cells.map((cell) => (
        <div key={cell} className={cn("w-2 h-2 rounded-full", cell <= value ? "bg-primary" : "bg-neutral-200")} />
      ))}
    </div>
  );
}

export function ModelInfoItem({
  label,
  value,
  showScale,
  scaleValue,
  className,
  ...props
}: {
  label: string;
  value: string;
  showScale?: boolean;
  scaleValue?: number;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("whitespace-nowrap flex items-center gap-2", className)} {...props}>
      <span className="italic text-muted-foreground">{label}:</span>
      {value && <span className="font-bold">{value}</span>}
      {showScale && scaleValue !== undefined && <ScaleIndicator value={scaleValue} />}
    </div>
  );
}

export function ModelDownloadButton({
  onDownload,
  onRemove,
  status,
  model,
}: {
  onDownload: (model: string) => void;
  onRemove: (model: string) => void;
  progress?: number;
  model: string;
  status: DownloadStateStatus;
}) {
  if (status === "downloaded") {
    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <div className="p-0.5">
            <Button variant="outline" size="icon" className="rounded-full w-5.5 h-5.5 text-xs [&_svg]:size-3">
              <Minus />
            </Button>
          </div>
        </AlertDialogTrigger>
        <AlertDialogContent className="w-fit max-w-[250px] rounded-lg overflow-hidden">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This will permanently delete the model file from your computer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-row gap-2 justify-center">
            <AlertDialogCancel className="mt-0 px-3 py-1 h-8">Cancel</AlertDialogCancel>
            <AlertDialogAction className="mt-0 px-3 py-1 h-8" onClick={() => onRemove(model)}>
              Continue
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  if (status === "downloading") {
    return (
      <div className="relative w-6 h-6 shrink-0">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full w-5.5 h-5.5 text-xs relative z-10 border-transparent [&_svg]:size-3 border-primary/40"
        >
          <Loader className="animate-spin" />
        </Button>
      </div>
    );
  }

  return (
    <div className="p-0.5 h-fit">
      <Button
        variant="default"
        size="icon"
        className="rounded-full w-5.5 h-5.5 text-xs [&_svg]:size-3"
        onClick={() => onDownload(model)}
      >
        <ArrowDown />
      </Button>
    </div>
  );
}

export function ModelDownloadWrapper({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-end flex-col gap-1 text-xs", className)} {...props}>
      {children}
    </div>
  );
}

export function ModelSizeInfo({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <span className={cn("text-muted-foreground text-xs", className)} {...props}>
      {children}
    </span>
  );
}

export function ModelInfo({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col text-xs mt-2 gap-1.5", className)} {...props}>
      {children}
    </div>
  );
}

export const formatParameters = (paramValue: number | undefined) => {
  if (paramValue === undefined) return "";

  if (paramValue < 1) {
    return `${(paramValue * 1000).toFixed(0)} M`;
  } else {
    return `${paramValue.toFixed(2)} B`;
  }
};

export const formatMemory = (mbValue: number | undefined) => {
  if (mbValue === undefined) return "";

  return `${(mbValue / 1024).toFixed(2)} GB`;
};
