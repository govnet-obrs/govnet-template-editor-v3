import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const getContentType = (filePath: string): string => {
  const ext = path.extname(filePath).toLowerCase()
  return CONTENT_TYPE_BY_EXTENSION[ext] ?? 'application/octet-stream'
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ assetPath: string[] }> }
) {
  const { assetPath } = await context.params
  if (!assetPath?.length) {
    return new NextResponse('Not found', { status: 404 })
  }

  const baseDir = path.resolve(process.cwd(), 'global-assets')
  const relativePath = assetPath.join('/')

  if (relativePath.includes('..') || path.isAbsolute(relativePath)) {
    return new NextResponse('Invalid path', { status: 400 })
  }

  const absoluteFilePath = path.resolve(baseDir, relativePath)
  const allowedPrefix = `${baseDir}${path.sep}`
  if (!absoluteFilePath.startsWith(allowedPrefix)) {
    return new NextResponse('Invalid path', { status: 400 })
  }

  try {
    const fileBuffer = await readFile(absoluteFilePath)
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': getContentType(absoluteFilePath),
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
