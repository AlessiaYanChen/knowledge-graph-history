import { useEditor, EditorContent, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { JSONContent } from '@tiptap/core'
import { Fragment, type ReactNode } from 'react'

type RichValue = { text: string; richContent: string; formatVersion: 1 }

function plainText(node: JSONContent): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'hardBreak') return '\n'
  return (node.content ?? []).map(plainText).join(node.type === 'paragraph' ? '' : '\n')
}

function legacyDocument(text: string): JSONContent {
  return { type: 'doc', content: text.split('\n').map(line => ({
    type: 'paragraph', content: line ? [{ type: 'text', text: line }] : [],
  })) }
}

function documentFor(text: string, richContent?: string | null, formatVersion?: number | null): JSONContent {
  if (formatVersion === 1 && richContent) {
    try { return JSON.parse(richContent) as JSONContent } catch { /* preserve readable text */ }
  }
  return legacyDocument(text)
}

function renderNode(node: JSONContent, key: number): ReactNode {
  const children = node.content?.map(renderNode)
  if (node.type === 'text') {
    let content: ReactNode = node.text ?? ''
    if (node.marks?.some(mark => mark.type === 'bold')) content = <strong>{content}</strong>
    if (node.marks?.some(mark => mark.type === 'italic')) content = <em>{content}</em>
    return <Fragment key={key}>{content}</Fragment>
  }
  if (node.type === 'hardBreak') return <br key={key} />
  if (node.type === 'paragraph') return <p key={key}>{children}</p>
  if (node.type === 'bulletList') return <ul key={key}>{children}</ul>
  if (node.type === 'orderedList') {
    const start = typeof node.attrs?.start === 'number' && Number.isInteger(node.attrs.start) && node.attrs.start > 0
      ? node.attrs.start : undefined
    return <ol key={key} start={start}>{children}</ol>
  }
  if (node.type === 'listItem') return <li key={key}>{children}</li>
  if (node.type === 'blockquote') return <blockquote key={key}>{children}</blockquote>
  return null
}

export function RichTextView({ text, richContent, formatVersion }: { text: string; richContent?: string | null; formatVersion?: number | null }) {
  return <div className="rich-view">{documentFor(text, richContent, formatVersion).content?.map(renderNode)}</div>
}

export function RichTextEditor({ text, richContent, formatVersion, onChange, label }: {
  text: string; richContent?: string | null; formatVersion?: number | null;
  onChange: (value: RichValue) => void; label: string
}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: false, code: false, codeBlock: false, horizontalRule: false,
      link: false, strike: false, underline: false })],
    content: documentFor(text, richContent, formatVersion),
    editorProps: { attributes: { id: label, role: 'textbox', 'aria-label': label, 'aria-multiline': 'true' } },
    onUpdate: ({ editor }) => {
      const doc = editor.getJSON()
      onChange({ text: plainText(doc), richContent: JSON.stringify(doc), formatVersion: 1 })
    },
  })
  const state = useEditorState({ editor, selector: ({ editor }) => ({
    bold: editor?.isActive('bold'), italic: editor?.isActive('italic'),
    bulletList: editor?.isActive('bulletList'), orderedList: editor?.isActive('orderedList'),
    blockquote: editor?.isActive('blockquote'),
  }) })
  if (!editor) return null
  const buttons = [
    { title: '加粗 (Ctrl/Cmd+B)', label: 'B', active: state?.bold, action: () => editor.chain().focus().toggleBold().run() },
    { title: '斜体 (Ctrl/Cmd+I)', label: 'I', active: state?.italic, action: () => editor.chain().focus().toggleItalic().run() },
    { title: '无序列表', label: '• 列表', active: state?.bulletList, action: () => editor.chain().focus().toggleBulletList().run() },
    { title: '有序列表', label: '1. 列表', active: state?.orderedList, action: () => editor.chain().focus().toggleOrderedList().run() },
    { title: '引用', label: '“ 引用', active: state?.blockquote, action: () => editor.chain().focus().toggleBlockquote().run() },
    { title: '撤销', label: '↶', active: false, action: () => editor.chain().focus().undo().run() },
    { title: '重做', label: '↷', active: false, action: () => editor.chain().focus().redo().run() },
  ]
  return <div className="rich-editor"><div className="rich-toolbar" role="toolbar" aria-label={`${label}格式`}>
    {buttons.map(button => <button type="button" key={button.title} title={button.title} aria-label={button.title}
      aria-pressed={button.active || false} onMouseDown={event => event.preventDefault()} onClick={button.action}>{button.label}</button>)}
  </div><EditorContent editor={editor} /></div>
}
