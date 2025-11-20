export type IconProps = React.ComponentProps<"svg">;

export type IconRegistry = {
  [key: string]: React.FC<IconProps>;
};
