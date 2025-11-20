import { useState } from "react";

export function useBoolean(initialValue: boolean) {
  const [value, setValue] = useState(initialValue);

  function toggle() {
    setValue((prev) => !prev);
  }

  function setTrue() {
    setValue(true);
  }

  function setFalse() {
    setValue(false);
  }

  return { value, toggle, setTrue, setFalse };
}
