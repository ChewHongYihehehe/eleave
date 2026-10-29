'use client'

import { useCallback } from 'react'
import { useLang } from '@/lib/lang'

// 三语小工具:tr('中文', 'English', 'Bahasa Melayu')
// 按当前语言(localStorage 'eleave-lang')返回对应的那一句。
// 用法:const { tr, lang, locale } = useTr()
export function useTr() {
  const { lang } = useLang()
  const tr = useCallback(
    (zh: string, en: string, ms: string) => (lang === 'zh' ? zh : lang === 'ms' ? ms : en),
    [lang]
  )
  // 给 toLocaleDateString 用
  const locale = lang === 'zh' ? 'zh-CN' : lang === 'ms' ? 'ms-MY' : 'en-GB'
  return { tr, lang, locale }
}
