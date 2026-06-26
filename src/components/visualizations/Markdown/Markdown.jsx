import React from 'react'

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function parseMarkdown(text) {
  if (!text) return ''
  let html = text

  if (!html.includes('<') || true) {
    html = html.replace(/^### (.+)$/gm, '<h3 class="text-sm font-bold text-zinc-800 dark:text-zinc-100 mt-3 mb-1">$1</h3>')
    html = html.replace(/^## (.+)$/gm, '<h2 class="text-base font-bold text-zinc-800 dark:text-zinc-100 mt-4 mb-1">$1</h2>')
    html = html.replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-zinc-800 dark:text-zinc-100 mt-4 mb-2">$1</h1>')

    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-zinc-800 dark:text-zinc-100">$1</strong>')
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
    html = html.replace(/`(.+?)`/g, '<code class="text-[#EF843C] bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>')

    html = html.replace(/^- (.+)$/gm, '<li class="text-zinc-600 dark:text-zinc-400 ml-4 list-disc text-[12px]">$1</li>')

    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#EF843C] hover:underline">$1</a>')

    html = html.replace(/```([\s\S]*?)```/g, '<pre class="bg-zinc-100 dark:bg-zinc-800/60 rounded-lg px-3 py-2 my-2 overflow-auto text-[11px] font-mono text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">$1</pre>')

    html = html.replace(/\n\n/g, '</p><p class="text-zinc-600 dark:text-zinc-400 text-[12px] leading-relaxed">')
    html = '<p class="text-zinc-600 dark:text-zinc-400 text-[12px] leading-relaxed">' + html + '</p>'

    html = html.replace(/<p[^>]*><\/p>/g, '')
    html = html.replace(/<li[^>]*><\/li>/g, '')
  }

  return html
}

export default function Markdown({ content = '', config = {} }) {
  if (!content) {
    return <div className="flex items-center justify-center h-32 text-zinc-400 text-xs">No content</div>
  }

  const html = config.enableHTML ? content : parseMarkdown(content)

  return (
    <div
      className={`prose prose-sm max-w-none ${config.style || ''}`}
      style={{ fontFamily: 'Inter, sans-serif' }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
