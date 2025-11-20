import { Toaster as Sooner } from "@renderer/components/sonner";
import { ExternalToast, toast, ToasterProps } from "sonner";

export const Toaster = (props: ToasterProps) => {
  return <Sooner position="top-right" duration={3000} {...props} />;
};

export type ToastProps = {
  title?: string;
} & ExternalToast;

export const successToast = (props?: ToastProps | string) => {
  if (typeof props === "string") {
    return toast.success(props);
  }

  const { title, ...rest } = {
    title: "Success",
    ...props,
  };

  return toast.success(title, {
    action: {
      label: "Close",
      onClick: () => {},
    },
    ...rest,
  });
};

export const errorToast = (props?: ToastProps | string) => {
  if (typeof props === "string") {
    return toast.error(props);
  }

  const { title, ...rest } = {
    title: "Error",
    ...props,
  };

  return toast.error(title, {
    action: {
      label: "Close",
      onClick: () => {},
    },
    ...rest,
  });
};

export const warningToast = (props?: ToastProps | string) => {
  if (typeof props === "string") {
    return toast.warning(props);
  }

  const { title, ...rest } = {
    title: "Warning",
    ...props,
  };

  return toast.warning(title, {
    action: {
      label: "Close",
      onClick: () => {},
    },
    ...rest,
  });
};
