export function isStreetId(value: unknown): value is string {
  return typeof value === 'string' && /^street-[a-z0-9]{1,64}$/i.test(value)
}
