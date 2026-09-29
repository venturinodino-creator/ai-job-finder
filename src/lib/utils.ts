import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merges Tailwind class lists, later classes winning (the shadcn/KokonutUI `cn` helper). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
