import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string, max = 2): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter((w) => w)
    .map((w) => w[0].toUpperCase())
    .slice(0, max)
    .join("");
}

