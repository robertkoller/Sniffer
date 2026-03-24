export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function canonicalSlug(brand: string, name: string): string {
  return generateSlug(`${brand} ${name}`);
}
