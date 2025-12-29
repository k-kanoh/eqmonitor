import { format } from "date-fns";

declare global {
  interface Date {
    toString(): string;
  }
}

Date.prototype.toString = function (): string {
  return format(this, "yyyy/MM/dd HH:mm:ss.SSS");
};

export {};
