import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function npr(amount: number) {
  return `NPR ${amount.toLocaleString('en-IN')}`;
}

export function fmtDate(dt: string | Date) {
  return new Date(dt).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
