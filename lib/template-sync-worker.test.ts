import { beforeEach, describe, expect, it } from 'vitest'
import {
  getAllTemplatesFromStorageForSyncing,
  getTemplateById,
  getTemplateType,
  isTemplateEligibleForSync,
  prepareSyncPayload,
} from './template-sync-worker'

type StorageMap = Record<string, string>

class LocalStorageMock implements Storage {
  private store: StorageMap = {}

  clear(): void {
    this.store = {}
  }

  getItem(key: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.store, key) ? this.store[key] : null
  }

  key(index: number): string | null {
    return Object.keys(this.store)[index] ?? null
  }

  removeItem(key: string): void {
    delete this.store[key]
  }

  setItem(key: string, value: string): void {
    this.store[key] = String(value)
  }

  get length(): number {
    return Object.keys(this.store).length
  }
}

function setTemplate(templateId: string, template: Record<string, unknown>, editorId = '') {
  localStorage.setItem(
    `template-${templateId}`,
    JSON.stringify({
      editorId,
      lastOpened: Date.now(),
      template,
    })
  )
}

describe('template-sync-worker', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: new LocalStorageMock(),
      configurable: true,
      writable: true,
    })
  })

  it('detects notify template type from email/sms fields', () => {
    expect(getTemplateType({ email: '<p>hello</p>' })).toBe('notify')
    expect(getTemplateType({ sms: 'hello' })).toBe('notify')
    expect(getTemplateType({ htmlContent: '<html></html>' })).toBe('docify')
  })

  it('applies eligibility rules per template type', () => {
    expect(isTemplateEligibleForSync({ email: '<p>notify</p>', sms: '' })).toBe(true)
    expect(isTemplateEligibleForSync({ htmlContent: '   ' })).toBe(false)
    expect(isTemplateEligibleForSync({ htmlContent: '<html>ok</html>' })).toBe(true)
  })

  it('includes notify templates without htmlContent in sync discovery', () => {
    setTemplate('notify-1', {
      id: 'notify-1',
      key: 'welcome',
      email: '<p>Hi {{.name}}</p>',
    }, 'editor-notify')

    const templates = getAllTemplatesFromStorageForSyncing()
    expect(templates).toHaveLength(1)
    expect(templates[0]).toMatchObject({
      templateId: 'notify-1',
      editorId: 'editor-notify',
    })
  })

  it('filters out stale templates older than one day', () => {
    localStorage.setItem(
      'template-old',
      JSON.stringify({
        editorId: 'editor-old',
        lastOpened: Date.now() - (25 * 60 * 60 * 1000),
        template: {
          id: 'old',
          htmlContent: '<html>Old</html>',
        },
      })
    )

    const templates = getAllTemplatesFromStorageForSyncing()
    expect(templates).toHaveLength(0)
  })

  it('returns full template record and type by id', () => {
    setTemplate('doc-1', {
      id: 'doc-1',
      name: 'Doc One',
      htmlContent: '<html>{{.name}}</html>',
      editorId: 'editor-doc',
    })

    const full = getTemplateById('doc-1')
    expect(full).not.toBeNull()
    expect(full?.type).toBe('docify')
    expect(full?.editorId).toBe('editor-doc')
  })

  it('builds payload count from discovered templates', () => {
    setTemplate('doc-2', {
      id: 'doc-2',
      name: 'Doc Two',
      htmlContent: '<html></html>',
    }, 'editor-doc')

    const payload = prepareSyncPayload()
    expect(payload.count).toBe(1)
    expect(payload.templates[0]?.templateId).toBe('doc-2')
  })
})
