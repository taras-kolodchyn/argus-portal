import clsx, { type ClassValue } from "clsx";

const cnInternal: (...inputs: ClassValue[]) => string = clsx;

export function cn(...inputs: ClassValue[]): string {
  return cnInternal(...inputs);
}
