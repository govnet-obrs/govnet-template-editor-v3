import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

interface SyncPayload {
  src?: unknown
  type?: unknown
  content?: unknown
}

export async function POST(request: Request) {
  let payload: SyncPayload
  try {
    payload = (await request.json()) as SyncPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const src = typeof payload.src === 'string' ? payload.src.trim() : ''
  const type = payload.type
  const content = typeof payload.content === 'string' ? payload.content : ''

  if (!src) {
    return NextResponse.json({ error: 'Missing src' }, { status: 400 })
  }

  if (type !== 'css' && type !== 'js') {
    return NextResponse.json(
      { error: 'Only css and js assets can be synced' },
      { status: 400 }
    )
  }

  if (/^https?:\/\//i.test(src)) {
    return NextResponse.json(
      { error: 'Remote assets are read-only and cannot be synced' },
      { status: 400 }
    )
  }

  if (src.includes('..') || path.isAbsolute(src)) {
    return NextResponse.json({ error: 'Invalid src path' }, { status: 400 })
  }

  const expectedExt = type === 'css' ? '.css' : '.js'
  if (!src.toLowerCase().endsWith(expectedExt)) {
    return NextResponse.json(
      { error: `Expected ${expectedExt} file for ${type} asset` },
      { status: 400 }
    )
  }

  const baseDir = path.resolve(process.cwd(), 'global-assets')
  const absoluteFilePath = path.resolve(baseDir, src)
  const allowedPrefix = `${baseDir}${path.sep}`
  if (!absoluteFilePath.startsWith(allowedPrefix)) {
    return NextResponse.json({ error: 'Invalid src path' }, { status: 400 })
  }

  try {
    await writeFile(absoluteFilePath, content, 'utf8')
    return NextResponse.json(
      {
        ok: true,
        src,
        type,
        updatedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch {
    return NextResponse.json(
      { error: 'Failed to write asset file' },
      { status: 500 }
    )
  }
}