import { supabase } from './supabaseClient'
import { DEFAULT_WORK_WEEK, normalizeWorkWeek, type WorkWeek } from './leaveRules'

// 读取公司的工作周设定(app_settings 表,key = 'work_week')。
// 表还没建 / 没有这一行 / 读取失败时,一律退回预设(周一到周五)。
export async function loadWorkWeek(): Promise<WorkWeek> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'work_week')
    .maybeSingle()
  if (error || !data) return { ...DEFAULT_WORK_WEEK }
  return normalizeWorkWeek(data.value)
}

export async function saveWorkWeek(workWeek: WorkWeek): Promise<string | null> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'work_week', value: workWeek, updated_at: new Date().toISOString() })
  return error ? error.message : null
}
