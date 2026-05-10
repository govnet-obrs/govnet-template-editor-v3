export type ManifestAssetType = 'css' | 'js' | 'binary'

export interface ManifestAsset {
  src: string
  name: string
  description?: string
  type: ManifestAssetType
  priority?: number
}

export interface ManifestFile {
  version: string
  assets: ManifestAsset[]
}

const GLOBAL_CSS_STYLE_ATTR = 'data-docify-global-css'
const GLOBAL_JS_SCRIPT_ATTR = 'data-docify-global-js'
const GLOBAL_CSS_STYLE_BLOCK_REGEX = new RegExp(
  `<style[^>]*${GLOBAL_CSS_STYLE_ATTR}=["'][^"']*["'][^>]*>[\\s\\S]*?<\\/style>`,
  'gi'
)
const GLOBAL_JS_SCRIPT_BLOCK_REGEX = new RegExp(
  `<script[^>]*${GLOBAL_JS_SCRIPT_ATTR}=["'][^"']*["'][^>]*>[\\s\\S]*?<\\/script>`,
  'gi'
)
const GLOBAL_CSS_STYLE_BLOCK_WITH_CAPTURE_REGEX = new RegExp(
  `(<style[^>]*${GLOBAL_CSS_STYLE_ATTR}=["'][^"']*["'][^>]*>)[\\s\\S]*?(<\\/style>)`,
  'gi'
)
const GLOBAL_JS_SCRIPT_BLOCK_WITH_CAPTURE_REGEX = new RegExp(
  `(<script[^>]*${GLOBAL_JS_SCRIPT_ATTR}=["'][^"']*["'][^>]*>)[\\s\\S]*?(<\\/script>)`,
  'gi'
)

export interface GlobalAssetContent {
  src: string
  type: ManifestAssetType
  content: string
}

export interface InjectedGlobalAssetsResult {
  injectedHtml: string
  cssContent: string
  jsContent: string
  cssAssetNames: string[]
  jsAssetNames: string[]
}

export const INJECTED_GLOBAL_CSS_ATTR = GLOBAL_CSS_STYLE_ATTR
export const INJECTED_GLOBAL_JS_ATTR = GLOBAL_JS_SCRIPT_ATTR

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

export const isLocalManifestSrc = (src: string): boolean => {
  if (!src.trim()) {
    return false
  }

  return !/^https?:\/\//i.test(src) && !src.startsWith('/')
}

export const isRemoteManifestSrc = (src: string): boolean => {
  return /^https?:\/\//i.test(src.trim())
}

export const normalizeManifestAssets = (payload: unknown): ManifestAsset[] => {
  if (!isRecord(payload) || !Array.isArray(payload.assets)) {
    return []
  }

  const seen = new Set<string>()
  const normalized: ManifestAsset[] = []

  for (const entry of payload.assets) {
    if (!isRecord(entry)) {
      continue
    }

    const src = typeof entry.src === 'string' ? entry.src.trim() : ''
    const name = typeof entry.name === 'string' ? entry.name.trim() : ''
    const description =
      typeof entry.description === 'string' ? entry.description.trim() : undefined
    const type = entry.type
    const priority =
      typeof entry.priority === 'number' ? entry.priority : undefined

    if (!src || !name) {
      continue
    }

    if (type !== 'css' && type !== 'js' && type !== 'binary') {
      continue
    }

    const isRemote = isRemoteManifestSrc(src)
    const isLocal = isLocalManifestSrc(src)

    // Only binary assets can reference remote URLs; CSS/JS must be local files.
    if ((type === 'css' || type === 'js') && !isLocal) {
      continue
    }
    if (type === 'binary' && !isLocal && !isRemote) {
      continue
    }

    if (seen.has(src)) {
      continue
    }

    seen.add(src)
    normalized.push({
      src,
      name,
      type,
      ...(description ? { description } : {}),
      ...(priority !== undefined ? { priority } : {}),
    })
  }

  return normalized.sort((a, b) => {
    const aPriority = a.priority ?? Number.MAX_SAFE_INTEGER
    const bPriority = b.priority ?? Number.MAX_SAFE_INTEGER
    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }
    return a.src.localeCompare(b.src)
  })
}

export const buildGlobalAssetApiPath = (src: string): string => {
  const encodedPath = src
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `/api/global-assets/${encodedPath}`
}

export const combineGlobalCssAssets = (assets: GlobalAssetContent[]): string => {
  const cssAssets = assets.filter((a) => a.type === 'css')
  if (!cssAssets.length) {
    return ''
  }

  return cssAssets
    .map((asset) => {
      const header = `/* Global CSS: ${asset.src} */`
      return `${header}\n${asset.content.trim()}`
    })
    .join('\n\n')
    .trim()
}

export const combineGlobalJsAssets = (assets: GlobalAssetContent[]): string => {
  const jsAssets = assets.filter((a) => a.type === 'js')
  if (!jsAssets.length) {
    return ''
  }

  return jsAssets
    .map((asset) => {
      const header = `// Global JS: ${asset.src}`
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

export const maskInjectedGlobalAssetsForEditing = (html: string): string => {
  const maskedCss = html.replace(
    GLOBAL_CSS_STYLE_BLOCK_WITH_CAPTURE_REGEX,
    (_match, openTag: string, closeTag: string) => {
      return `${openTag}\n/* this content is auto injected. */\n${closeTag}`
    }
  )

  return maskedCss.replace(
    GLOBAL_JS_SCRIPT_BLOCK_WITH_CAPTURE_REGEX,
    (_match, openTag: string, closeTag: string) => {
      return `${openTag}\n/* this content is auto injected. */\n${closeTag}`
    }
  )
}

const buildInjectedAssetNamesAttr = (assetNames: string[]): string => {
  const normalized = assetNames
    .map((name) => name.trim().replace(/,/g, '_'))
    .filter(Boolean)

  return normalized.length > 0 ? normalized.join(',') : 'inline'
}

export const injectGlobalCssIntoHtml = (
  html: string,
  cssContent: string,
  assetNames: string[] = []
): string => {
  const baseHtml = stripInjectedGlobalCss(html)
  const normalizedCss = cssContent.trim()
  if (!normalizedCss) {
    return baseHtml
  }

  const injectedAssetNames = buildInjectedAssetNamesAttr(assetNames)
  const styleTag = `<style ${GLOBAL_CSS_STYLE_ATTR}="${injectedAssetNames}">\n${normalizedCss}\n</style>`
  if (/<head[^>]*>/i.test(baseHtml)) {
    return baseHtml.replace(/<head[^>]*>/i, (match) => `${match}\n${styleTag}`)
  }

  if (/<html[^>]*>/i.test(baseHtml)) {
    return baseHtml.replace(/<html[^>]*>/i, (match) => `${match}\n<head>\n${styleTag}\n</head>`)
  }

  return `${styleTag}\n${baseHtml}`.trim()
}

export const injectGlobalJsIntoHtml = (
  html: string,
  jsContent: string,
  assetNames: string[] = []
): string => {
  const baseHtml = stripInjectedGlobalJs(html)
  const normalizedJs = jsContent.trim()
  if (!normalizedJs) {
    return baseHtml
  }

  const injectedAssetNames = buildInjectedAssetNamesAttr(assetNames)
  const scriptTag = `<script ${GLOBAL_JS_SCRIPT_ATTR}="${injectedAssetNames}">\n${normalizedJs}\n</script>`
  
  if (/<\/body[^>]*>/i.test(baseHtml)) {
    return baseHtml.replace(/<\/body[^>]*>/i, (match) => `${scriptTag}\n${match}`)
  }

  if (/<\/html[^>]*>/i.test(baseHtml)) {
    return baseHtml.replace(/<\/html[^>]*>/i, (match) => `${scriptTag}\n${match}`)
  }

  return `${baseHtml}\n${scriptTag}`.trim()
}

export const injectGlobalAssetsIntoHtml = (
  html: string,
  cssContent: string,
  jsContent: string,
  cssAssetNames: string[] = [],
  jsAssetNames: string[] = []
): string => {
  let result = html
  if (cssContent.trim()) {
    result = injectGlobalCssIntoHtml(result, cssContent, cssAssetNames)
  }
  if (jsContent.trim()) {
    result = injectGlobalJsIntoHtml(result, jsContent, jsAssetNames)
  }
  return result
}

export const parseInjectedAssetNamesFromHtml = (
  html: string,
  attrName: string
): string[] => {
  const regex = new RegExp(`${attrName}=["']([^"']*)["']`, 'i')
  const match = html.match(regex)
  if (!match || !match[1]) {
    return []
  }

  return match[1]
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
}

export const buildInjectedGlobalAssetsFromManifest = async (
  html: string,
  manifestAssets: Array<ManifestAsset & { url?: string }>,
  maxCacheableAssetSize?: number
): Promise<InjectedGlobalAssetsResult> => {
  const cssNamesFromHtml = parseInjectedAssetNamesFromHtml(html, INJECTED_GLOBAL_CSS_ATTR)
  const jsNamesFromHtml = parseInjectedAssetNamesFromHtml(html, INJECTED_GLOBAL_JS_ATTR)

  const cssNameSet = new Set(cssNamesFromHtml.map((name) => name.toLowerCase()))
  const jsNameSet = new Set(jsNamesFromHtml.map((name) => name.toLowerCase()))

  const cssAssets = manifestAssets.filter(
    (asset) => asset.type === 'css' && cssNameSet.has(asset.name.toLowerCase())
  )
  const jsAssets = manifestAssets.filter(
    (asset) => asset.type === 'js' && jsNameSet.has(asset.name.toLowerCase())
  )

  const loadedCssAssets: GlobalAssetContent[] = []
  const loadedJsAssets: GlobalAssetContent[] = []

  const loadAssetContent = async (asset: ManifestAsset & { url?: string }): Promise<string | null> => {
    const assetUrl = asset.url || buildGlobalAssetApiPath(asset.src)
    const response = await fetch(assetUrl, { cache: 'no-store' })
    if (!response.ok) {
      return null
    }

    if (maxCacheableAssetSize && maxCacheableAssetSize > 0) {
      const contentLength = response.headers.get('content-length')
      const fileSizeBytes = contentLength ? parseInt(contentLength, 10) : 0
      if (fileSizeBytes > 0 && fileSizeBytes > maxCacheableAssetSize) {
        return null
      }
    }

    return response.text()
  }

  for (const asset of cssAssets) {
    try {
      const content = await loadAssetContent(asset)
      if (content === null) {
        continue
      }
      loadedCssAssets.push({
        src: asset.src,
        type: 'css',
        content,
      })
    } catch {
      // Best-effort loading: skip failed assets and continue.
    }
  }

  for (const asset of jsAssets) {
    try {
      const content = await loadAssetContent(asset)
      if (content === null) {
        continue
      }
      loadedJsAssets.push({
        src: asset.src,
        type: 'js',
        content,
      })
    } catch {
      // Best-effort loading: skip failed assets and continue.
    }
  }

  const cssContent = combineGlobalCssAssets(loadedCssAssets)
  const jsContent = combineGlobalJsAssets(loadedJsAssets)
  const cssAssetNames = cssAssets
    .filter((asset) => loadedCssAssets.some((loadedAsset) => loadedAsset.src === asset.src))
    .map((asset) => asset.name)
  const jsAssetNames = jsAssets
    .filter((asset) => loadedJsAssets.some((loadedAsset) => loadedAsset.src === asset.src))
    .map((asset) => asset.name)

  return {
    injectedHtml: injectGlobalAssetsIntoHtml(
      html,
      cssContent,
      jsContent,
      cssAssetNames,
      jsAssetNames
    ),
    cssContent,
    jsContent,
    cssAssetNames,
    jsAssetNames,
  }
}
