import { format, subDays } from "date-fns";

export class CustomDate {
  static format(value: string | Date, formatStr = "dd MMMM yyyy") {
    return format(new Date(value), formatStr);
  }

  static subDays(value: string | Date, days: number) {
    return subDays(new Date(value), days);
  }
}
