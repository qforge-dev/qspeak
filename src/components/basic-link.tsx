import { cn } from "@renderer/utils/cn";
import { NavLink, NavLinkProps } from "react-router";

export type BasicLinkProps = Omit<NavLinkProps, "className"> & {
  className?: string | ((props: { isActive: boolean }) => string);
};

export function BasicLink({ className, ...rest }: BasicLinkProps) {
  return <NavLink className={typeof className === "function" ? className : (_) => cn("", className)} {...rest} />;
}
