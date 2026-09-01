// Build-time VitePress data loader (07-19-PLAN.md, D-25). Reads the vendored
// registry snapshot at ./public/deprecations.json and hands parsed rows to
// deprecations.md / zh/guide/advanced/deprecations.md via `<script setup>`.
// This is a build-time read, not a runtime fetch -- the rendered table is
// static HTML, present in the page at build time, so VitePress local search
// indexes it like any other page text.
//
// Shared between the EN and ZH pages (same convention as the `<<<
// @/../examples/...` Java includes) -- do not fork a second copy for zh/.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export interface DeprecationEntry {
    key: string
    className: string
    memberName?: string
    kind: string
    since: string
    forRemoval: boolean
    removeIn?: string
    replacement: string
    status: 'DEPRECATED' | 'ANNOUNCED' | 'REMOVED'
    removedIn?: string
}

declare const data: DeprecationEntry[]
export { data }

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default {
    watch: ['./public/deprecations.json'],
    load(): DeprecationEntry[] {
        const file = path.join(__dirname, 'public/deprecations.json')
        const raw = fs.readFileSync(file, 'utf-8')
        const entries = JSON.parse(raw) as DeprecationEntry[]
        return entries.slice().sort((a, b) => a.key.localeCompare(b.key))
    }
}
