'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 打印具体错误到浏览器控制台，方便排查
    console.error('Application error caught by boundary:', error)
  }, [error])

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gray-50 px-6 py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 mb-4 shadow-xs">
        <svg width={32} height={32} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>

      <h1 className="text-xl font-bold text-gray-900">页面加载遇到问题</h1>
      <p className="mt-1 text-sm text-gray-500">Something went wrong while loading this page</p>

      {error?.message && (
        <div className="mt-4 max-w-md w-full rounded-xl bg-white border border-gray-200 p-3.5 text-left text-xs font-mono text-gray-600 shadow-2xs overflow-x-auto">
          <p className="text-[11px] font-bold text-red-500 mb-1">Error details:</p>
          <p className="break-all">{error.message}</p>
        </div>
      )}

      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={() => reset()}
          className="w-full sm:w-auto rounded-xl bg-brand px-6 py-2.5 text-sm font-semibold text-white shadow-xs transition-all active:scale-[0.98]"
        >
          重新尝试 (Retry)
        </button>
        <Link
          href="/workspace"
          className="w-full sm:w-auto rounded-xl border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 shadow-2xs hover:bg-gray-50 transition-all text-center"
        >
          返回工作台 (Workspace)
        </Link>
      </div>
    </div>
  )
}
