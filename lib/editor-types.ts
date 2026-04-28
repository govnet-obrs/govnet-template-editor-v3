export type EditorType = 'notify' | 'docify'
export type SyncMode = 'local' | 'online'
export type CredentialsType = 'header' | 'query'

export interface Credential {
  key: string
  value: string
}

export interface EditorConfig {
  id: string
  name: string
  type: EditorType
  syncMode: SyncMode
  apiUrl: string
  localPreviewUrl?: string
  credentialsType: CredentialsType
  credentials: Credential[]
  createdAt: string
  updatedAt: string
}

export interface Editor {
  id: string
  name: string
  type: EditorType
}
