import { cn } from "@renderer/utils/cn";
import { createContext, useContext, useState } from "react";
import { Button, ButtonProps } from "./button";

interface ICustomTabContext {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const CustomTabContext = createContext<ICustomTabContext | null>(null);

interface ICustomTabProps {
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  defaultTab?: string;
}

export function CustomTabs({ children, activeTab: activeTabProp, onTabChange, defaultTab }: ICustomTabProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || "");

  const onChange = (tab: string) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const tab = activeTabProp || activeTab;

  return (
    <CustomTabContext.Provider value={{ activeTab: tab, setActiveTab: onChange }}>{children}</CustomTabContext.Provider>
  );
}

export function CustomTabButton({ children, tab, className, ...props }: ButtonProps & { tab: string }) {
  const { setActiveTab, activeTab } = useCustomTab();

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    setActiveTab(tab);
    props.onClick?.(e);
  };

  return (
    <Button
      data-active={activeTab === tab}
      variant="ghost"
      className={cn("justify-start rounded-none", className)}
      onClick={onClick}
      {...props}
    >
      {children}
    </Button>
  );
}

export function CustomTabContent({
  children,
  className,
  tab,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { tab: string }) {
  const { activeTab } = useCustomTab();

  return (
    <div className={cn({ hidden: activeTab !== tab }, className)} {...props}>
      {children}
    </div>
  );
}

export function useCustomTab() {
  const context = useContext(CustomTabContext);
  if (!context) {
    throw new Error("useCustomTab must be used within a CustomTab");
  }
  return context;
}
