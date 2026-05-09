export type EditorType = 'notify' | 'docify'
export type SyncMode = 'local' | 'online'
export type CredentialsType = 'header' | 'query'
export type GlobalAssetType = 'css' | 'js' | 'binary'

export interface Credential {
  key: string
  value: string
}

export interface GlobalAssetReference {
  fileName: string
  type: GlobalAssetType
  description?: string
}

export interface EditorConfig {
  id: string
  name: string
  type: EditorType
  syncMode: SyncMode
  apiUrl: string
  localPreviewUrl?: string
  /** Docify-only: ordered list of relative PDF preview endpoint paths (e.g. ["/documents/preview-document"]). Index 0 = v1. */
  previewEndpoints?: string[]
  /** Docify-only: ordered list of uploaded global asset storage file references (CSS, JS, images, fonts). */
  globalAssets?: GlobalAssetReference[]
  credentialsType: CredentialsType
  credentials: Credential[]
  createdAt: string
  updatedAt: string
}

export const DEFAULT_PREVIEW_ENDPOINTS: string[] = ['/documents/preview-document']

export interface Editor {
  id: string
  name: string
  type: EditorType
}
