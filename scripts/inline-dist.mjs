import fs from 'node:fs/promises'
import path from 'node:path'

const distDir = path.resolve('dist')
const indexPath = path.join(distDir, 'index.html')

function escapeInlineScript(code) {
  return code.replace(/<\/script/gi, '<\\/script')
}

async function main() {
  const html = await fs.readFile(indexPath, 'utf8')

  const cssMatch = html.match(
    /<link\s+rel="stylesheet"\s+crossorigin\s+href="([^"]+)">\s*/i,
  )
  const jsMatch = html.match(
    /<script\s+type="module"\s+crossorigin\s+src="([^"]+)"><\/script>\s*/i,
  )

  if (!cssMatch || !jsMatch) {
    throw new Error('Could not find the built CSS/JS links to inline.')
  }

  const cssHref = cssMatch[1]
  const jsSrc = jsMatch[1]

  const cssPath = path.join(distDir, cssHref.replace(/^\.\//, ''))
  const jsPath = path.join(distDir, jsSrc.replace(/^\.\//, ''))

  const [css, js] = await Promise.all([
    fs.readFile(cssPath, 'utf8'),
    fs.readFile(jsPath, 'utf8'),
  ])

  const inlinedHtml = html
    .replace(cssMatch[0], () => `<style>\n${css}\n</style>\n`)
    .replace(jsMatch[0], () => `<script type="module">\n${escapeInlineScript(js)}\n</script>\n`)

  await fs.writeFile(indexPath, inlinedHtml, 'utf8')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
