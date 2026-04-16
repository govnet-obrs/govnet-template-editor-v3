export function decodeBase64Utf8(value: string): string {
  if (!value) {
    return ''
  }

  const binary = atob(value)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}