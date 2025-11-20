import { cn } from "@renderer/utils/cn";
import { HTMLAttributes, useMemo } from "react";
import { ChallengeStatus as ChallengeStatusType } from "@renderer/hooks/useNewState";
import { Check } from "lucide-react";
import { Markdown } from "@renderer/components/markdown";
import { useAppState } from "@renderer/hooks/useAppState";
import { Shortcut } from "@renderer/utils/shortcut";

export function ChallengesWrapper({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("grid grid-cols-1 gap-2 scrollbar-custom", className)} {...props} />;
}

export function ChallengeItem({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex gap-3 bg-background-surface rounded-xl p-3 last:mb-4 first:mt-2", className)} {...props} />
  );
}

export function ChallengeStatus({
  className,
  status,
  ...props
}: HTMLAttributes<HTMLDivElement> & { status: ChallengeStatusType }) {
  return (
    <div
      className={cn(
        "w-2.5 h-2.5 shrink-0 outline outline-4 rounded-full mt-1 flex items-center justify-center",
        {
          "bg-primary outline-primary/15 text-white": status === "Completed",
          "bg-white border border-neutral-300 outline-gray-500/10": status === "Available" || status === "InProgress",
        },
        className,
      )}
      {...props}
    >
      {status === "Completed" ? <Check className="size-2" /> : null}
    </div>
  );
}

export function ChallengeContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex justify-between gap-2 w-full items-center", className)} {...props} />;
}

export function ChallangeContentHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-0.5 grow w-full", className)} {...props} />;
}

export function ChallengeTitle({
  className,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "children"> & { children: string }) {
  return (
    <div className={cn("text-[13px] font-medium text-foreground", className)} {...props}>
      <ChallengeMarkdown>{children}</ChallengeMarkdown>
    </div>
  );
}

export function ChallengeDescription({
  className,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "children"> & { children: string }) {
  const state = useAppState();
  const textAfterReplacement = useMemo(() => {
    return children.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      try {
        const keys = path.split(".");
        let value: any = state.state?.context;
        for (const key of keys) {
          if (value && typeof value === "object" && key in value) {
            value = value[key];
          } else {
            return match; // Keep original if path is invalid
          }
        }
        if (Array.isArray(value)) {
          return value.map((v) => Shortcut.keyToIcon(v)).join(" + ");
        }
        return String(value ?? match);
      } catch (error) {
        console.error("Error replacing shortcut in challenge:", error);
        return match;
      }
    });
  }, [children, state]);
  return (
    <div className={cn("text-xs text-muted-foreground max-w-lg", className)} {...props}>
      <ChallengeMarkdown>{textAfterReplacement}</ChallengeMarkdown>
    </div>
  );
}

export function ChallengeProgress({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: React.ReactNode }) {
  return (
    <div className={cn("flex items-center gap-2 text-foreground", className)} {...props}>
      {children}
    </div>
  );
}

export function CircularProgressChart({
  value,
  max,
  size = 28,
  strokeWidth = 3,
  className,
  showLabel = false,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const progress = max === 0 ? 0 : value / max;
  const offset = circumference - progress * circumference;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
        <circle
          className="text-gray-200 dark:text-gray-700"
          strokeWidth={strokeWidth}
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
        <circle
          className="text-green-500 transition-all duration-300 ease-in-out"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke="currentColor"
          fill="transparent"
          r={radius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      {showLabel && (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-muted-foreground">
          {Math.round(progress * 100)}%
        </div>
      )}
    </div>
  );
}

function ChallengeMarkdown({ children }: { children: string }) {
  return (
    <Markdown
      options={{
        components: {
          p: ({ children }) => <p className="m-0">{children}</p>,
          a: ({ children, ...props }) => (
            <a className="text-blue-500" {...props}>
              {children}
            </a>
          ),
          h1: ({ children }) => <h1 className="text-lg font-medium">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-medium">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-medium">{children}</h3>,
          h4: ({ children }) => <h4 className="text-base font-medium">{children}</h4>,
          h5: ({ children }) => <h5 className="text-base font-medium">{children}</h5>,
          h6: ({ children }) => <h6 className="text-base font-medium">{children}</h6>,
        },
      }}
    >
      {children}
    </Markdown>
  );
}

export function ChallengeLinearProgress({
  progress,
  target,
  className,
}: {
  progress: number;
  target: number;
  className?: string;
}) {
  const progressPercentage = Math.min(100, (progress / target) * 100);

  return (
    <div className={cn("w-[120px] flex flex-col gap-1", className)}>
      <div className="relative w-full h-1.5 bg-background-surface-high rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
      <div className="flex justify-end items-center">
        <span className="text-xs text-muted-foreground">
          {Math.round(progress).toLocaleString()} / {target.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
