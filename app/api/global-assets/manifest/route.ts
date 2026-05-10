import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { NextResponse } from 'next/server'
import {
  buildGlobalAssetApiPath,
  isRemoteManifestSrc,
  normalizeManifestAssets,
} from '@/lib/docify-global-assets'

export async function GET() {
  try {
    const manifestPath = path.join(process.cwd(), 'global-assets', 'manifest.json')
    const rawManifest = await readFile(manifestPath, 'utf8')
    const parsed = JSON.parse(rawManifest) as unknown
    const assets = normalizeManifestAssets(parsed)

    return NextResponse.json(
      {
        version:
          typeof (parsed as { version?: unknown })?.version === 'string'
            ? (parsed as { version: string }).version
            : '1.0.0',
        assets: assets.map((asset) => ({
          ...asset,
          url: isRemoteManifestSrc(asset.src)
            ? asset.src
            : buildGlobalAssetApiPath(asset.src),
        })),
      },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    )
  } catch {
    return NextResponse.json(
      {
        version: '1.0.0',
        assets: [],
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
