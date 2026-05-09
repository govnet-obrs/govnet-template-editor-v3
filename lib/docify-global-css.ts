import type {
  Credential,
  CredentialsType,
  GlobalAssetReference,
  GlobalAssetType,
} from '@/lib/editor-types'

const GLOBAL_CSS_STYLE_ATTR = 'data-docify-global-css'
const GLOBAL_JS_SCRIPT_ATTR = 'data-docify-global-js'
const GLOBAL_CSS_STYLE_BLOCK_REGEX = new RegExp(
  `<style[^>]*${GLOBAL_CSS_STYLE_ATTR}=["']true["'][^>]*>[\\s\\S]*?<\\/style>`,
  'gi'
)
const GLOBAL_JS_SCRIPT_BLOCK_REGEX = new RegExp(
  `<script[^>]*${GLOBAL_JS_SCRIPT_ATTR}=["']true["'][^>]*>[\\s\\S]*?<\\/script>`,
  'gi'
)

export interface GlobalAsset {
  fileName: string
  type: GlobalAssetType
  content: string
}

export interface StorageFetchResult {
  fileName: string
  content: string | null
  error: string | null
}

/**
 * Normalize global assets to ensure consistent structure and deduplication.
 * Handles backward compatibility with old globalCssFiles format.
 */
export const normalizeGlobalAssets = (
  assets: Array<GlobalAssetReference | string> | undefined
): GlobalAssetReference[] => {
  if (!assets?.length) {
    return []
  }

  const seen = new Set<string>()
  return assets
    .map((entry) => {
      if (typeof entry === 'string') {
        // Backward compatibility: legacy string[] format assumed CSS
        const fileName = entry.trim()
        if (!fileName) {
          return null
        }
        return { fileName, type: 'css' as const }
      }

      if (!entry || typeof entry.fileName !== 'string') {
        return null
      }

      const fileName = entry.fileName.trim()
      if (!fileName) {
        return null
      }

      const type = (entry.type || 'css') as GlobalAssetType
      const description = typeof entry.description === 'string' ? entry.description.trim() : undefined
      return {
        fileName,
        type,
        ...(description ? { description } : {}),
      }
    })
    .filter((entry): entry is GlobalAssetReference => {
      if (!entry || seen.has(entry.fileName)) {
        return false
      }
      seen.add(entry.fileName)
      return true
    })
}

/**
 * Legacy function for backward compatibility - normalizes old CSS format
 */
export const normalizeGlobalCssFiles = (
  files: Array<{ fileName: string; description?: string } | string> | undefined
): GlobalAssetReference[] => {
  if (!files?.length) {
    return []
  }

  return normalizeGlobalAssets(
    (files as any[]).map((f) => 
      typeof f === 'string' ? f : { ...f, type: 'css' }
    )
  )
}

export const combineGlobalCssAssets = (assets: GlobalAsset[]): string => {
  const cssAssets = assets.filter((a) => a.type === 'css')
  if (!cssAssets.length) {
    return ''
  }

  return cssAssets
    .map((asset) => {
      const header = `/* Global CSS: ${asset.fileName} */`
      return `${header}\n${asset.content.trim()}`
    })
    .join('\n\n')
    .trim()
}

export const combineGlobalJsAssets = (assets: GlobalAsset[]): string => {
  const jsAssets = assets.filter((a) => a.type === 'js')
  if (!jsAssets.length) {
    return ''
  }

  return jsAssets
    .map((asset) => {
      const header = `// Global JS: ${asset.fileName}`
      return `${header}\n${asset.content.trim()}`
    })
    .join('\n\n')
    .trim()
}

export const stripInjectedGlobalCss = (html: string): string => {
  return html.replace(GLOBAL_CSS_STYLE_BLOCK_REGEX, '').trim()
}

export const stripInjectedGlobalJs = (html: string): string => {
  return html.replace(GLOBAL_JS_SCRIPT_BLOCK_REGEX, '').trim()
}

export const stripInjectedGlobalAssets = (html: string): string => {
  return stripInjectedGlobalJs(stripInjectedGlobalCss(html)).trim()
}

export const injectGlobalCssIntoHtml = (html: string, cssContent: string): string => {
  const baseHtml = stripInjectedGlobalCss(html)
  const normalizedCss = cssContent.trim()
  if (!normalizedCss) {
    return baseHtml
  }

  const styleTag = `<style ${GLOBAL_CSS_STYLE_ATTR}="true">\n${normalizedCss}\n</style>`
  if (/<head[^>]*>/i.test(baseHtml)) {
    return baseHtml.replace(/<head[^>]*>/i, (match) => `${match}\n${styleTag}`)
  }

  if (/<html[^>]*>/i.test(baseHtml)) {
    return baseHtml.replace(/<html[^>]*>/i, (match) => `${match}\n<head>\n${styleTag}\n</head>`)
  }

  return `${styleTag}\n${baseHtml}`.trim()
}

export const injectGlobalJsIntoHtml = (html: string, jsContent: string): string => {
  const baseHtml = stripInjectedGlobalJs(html)
  const normalizedJs = jsContent.trim()
  if (!normalizedJs) {
    return baseHtml
  }

  const scriptTag = `<script ${GLOBAL_JS_SCRIPT_ATTR}="true">\n${normalizedJs}\n</script>`
  
  if (/<\/body[^>]*>/i.test(baseHtml)) {
    return baseHtml.replace(/<\/body[^>]*>/i, (match) => `${scriptTag}\n${match}`)
  }

  if (/<\/html[^>]*>/i.test(baseHtml)) {
    return baseHtml.replace(/<\/html[^>]*>/i, (match) => `${scriptTag}\n${match}`)
  }

  return `${baseHtml}\n${scriptTag}`.trim()
}

export const injectGlobalAssetsIntoHtml = (html: string, cssContent: string, jsContent: string): string => {
  let result = html
  if (cssContent.trim()) {
    result = injectGlobalCssIntoHtml(result, cssContent)
  }
  if (jsContent.trim()) {
    result = injectGlobalJsIntoHtml(result, jsContent)
  }
  return result
}

export const buildCredentialHeaders = (
  credentialsType: CredentialsType,
  credentials: Credential[],
  includeJson = false
): HeadersInit => {
  const headers: HeadersInit = {}

  if (includeJson) {
    headers['Content-Type'] = 'application/json'
  }

  if (credentialsType === 'header') {
    credentials.forEach((cred) => {
      if (cred.key && cred.value) {
        headers[cred.key] = cred.value
      }
    })
  }

  return headers
}

export const appendCredentialQueryParams = (
  url: string,
  credentialsType: CredentialsType,
  credentials: Credential[]
): string => {
  if (credentialsType !== 'query') {
    return url
  }

  const params = new URLSearchParams()
  credentials.forEach((cred) => {
    if (cred.key && cred.value) {
      params.append(cred.key, cred.value)
    }
  })

  if (Array.from(params.keys()).length === 0) {
    return url
  }

  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}${params.toString()}`
}

export const parseStorageUploadResponse = (payload: unknown): string | null => {
  if (typeof payload === 'string') {
    return payload.trim() || null
  }

  if (typeof payload !== 'object' || payload === null) {
    return null
  }

  const record = payload as Record<string, unknown>
  const candidates = ['fileName', 'filename', 'name', 'data']

  for (const key of candidates) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

export const buildStorageFileUrl = (apiUrl: string, fileName: string): string => {
  const normalizedBase = apiUrl.endsWith('/') ? apiUrl.slice(0, -1) : apiUrl
  return `${normalizedBase}/storage/${encodeURIComponent(fileName)}`
}
