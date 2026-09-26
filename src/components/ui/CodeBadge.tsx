// Account code from دليل الحسابات shown before a statement line's label.
export default function CodeBadge({ code }: { code: string | number | null | undefined }) {
  if (code == null) return null
  return <span className="inline-block min-w-[3.25rem] text-xs font-mono text-gray-400 tabular-nums ml-2" dir="ltr">{code}</span>
}
