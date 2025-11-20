import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@renderer/components/select";
import { useTranslation } from "react-i18next";

export function InterfaceLanguageSelect({ onChange, value }: { value: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();

  return (
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger className="w-[100px] text-xs h-8 px-2">
        <SelectValue placeholder={t("Language")} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="pl">PL</SelectItem>
        <SelectItem value="en">EN</SelectItem>
      </SelectContent>
    </Select>
  );
}
