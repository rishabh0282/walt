import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Merge Tailwind CSS classes intelligently
 * 
 * Combines clsx for conditional classes with tailwind-merge to handle conflicts.
 * Essential for component libraries where props may override default styles
 * (e.g., passing 'p-4' should override default 'p-2', not apply both)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format bytes into human-readable file sizes
 * 
 * Stops at MB to avoid confusion with IPFS's tendency to chunk large files.
 * The displayed size reflects what's stored in metadata, not chunk count.
 */
export function formatFileSize(bytes?: number): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
