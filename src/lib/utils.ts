import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  return String(e)
}
