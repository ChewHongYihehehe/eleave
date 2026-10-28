'use client'

import { useState } from 'react'

export type HelpRole = 'employee' | 'manager'

interface HelpDocModalProps {
  isOpen: boolean
  onClose: () => void
  defaultRole?: HelpRole
}

export default function HelpDocModal({
  isOpen,
  onClose,
  defaultRole = 'employee',
}: HelpDocModalProps) {
  const [activeTab, setActiveTab] = useState<HelpRole>(defaultRole)
  const [expandedSection, setExpandedSection] = useState<string>('emp-apply')

  if (!isOpen) return null

  const toggleSection = (id: string) => {
    setExpandedSection((prev) => (prev === id ? '' : id))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150">
      <div 
        className="relative flex flex-col w-full max-w-3xl max-h-[90vh] rounded-2xl border border-line bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 顶部 Header ── */}
        <div className="flex items-center justify-between border-b border-line bg-paper/50 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pine-soft text-pine font-bold shadow-xs">
              📖
            </div>
            <div>
              <h2 className="text-base font-bold text-ink">eLeave 系统使用指引与常见问题</h2>
              <p className="text-xs text-ink-faint">快速了解请假规范、审批流转与工时报表核算</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint hover:bg-paper hover:text-ink transition-colors"
          >
            ✕
          </button>
        </div>

        {/* ── 角色切换 Tabs (钉钉/飞书胶囊风格) ── */}
        <div className="flex items-center justify-between border-b border-line bg-white px-6 py-2.5">
          <div className="flex rounded-lg bg-paper p-1 text-xs">
            <button
              onClick={() => { setActiveTab('employee'); setExpandedSection('emp-apply') }}
              className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 font-medium transition-all ${
                activeTab === 'employee'
                  ? 'bg-white text-pine font-semibold shadow-xs'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <span>👤 员工端指引 (Staff)</span>
            </button>
            <button
              onClick={() => { setActiveTab('manager'); setExpandedSection('mgr-approve') }}
              className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 font-medium transition-all ${
                activeTab === 'manager'
                  ? 'bg-white text-pine font-semibold shadow-xs'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              <span>💼 主管 / HR 管理端 (Manager)</span>
            </button>
          </div>
          <span className="text-[11px] text-ink-faint hidden sm:inline">
            点击问题卡片可展开或收起详细说明
          </span>
        </div>

        {/* ── 内容滚屏区 ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'employee' ? (
            /* ════════ 员工端指引 ════════ */
            <>
              {/* 模块 1: 请假申请 */}
              <div className="rounded-xl border border-line bg-surface overflow-hidden">
                <button
                  onClick={() => toggleSection('emp-apply')}
                  className="flex w-full items-center justify-between p-4 text-left font-medium text-sm text-ink hover:bg-paper/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-pine-soft text-pine text-xs font-bold">1</span>
                    <span className="font-semibold">如何发起请假申请？</span>
                  </div>
                  <span className="text-xs text-ink-faint">{expandedSection === 'emp-apply' ? '▲ 收起' : '▼ 展开'}</span>
                </button>
                {expandedSection === 'emp-apply' && (
                  <div className="border-t border-line/60 bg-white p-4 text-xs text-ink-soft leading-relaxed space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg bg-paper p-3 border border-line/50">
                        <p className="font-semibold text-ink text-xs mb-1">步骤 1: 点击发起申请</p>
                        <p className="text-ink-faint">在工作台右上角点击「<span className="text-pine font-medium">+ Request Leave</span>」按钮。</p>
                      </div>
                      <div className="rounded-lg bg-paper p-3 border border-line/50">
                        <p className="font-semibold text-ink text-xs mb-1">步骤 2: 选择类型与日期</p>
                        <p className="text-ink-faint">支持年假 (Annual)、病假 (MC)、无薪假 (Unpaid) 等，支持整天或半天假（上午/下午）。</p>
                      </div>
                      <div className="rounded-lg bg-paper p-3 border border-line/50">
                        <p className="font-semibold text-ink text-xs mb-1">步骤 3: 系统自动扣除排班</p>
                        <p className="text-ink-faint">系统已自动剔除周末与马来西亚法定公休日，无需手动扣除假期天数。</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 模块 2: 病假 MC 凭证要求 */}
              <div className="rounded-xl border border-line bg-surface overflow-hidden">
                <button
                  onClick={() => toggleSection('emp-mc')}
                  className="flex w-full items-center justify-between p-4 text-left font-medium text-sm text-ink hover:bg-paper/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-600 text-xs font-bold">2</span>
                    <span className="font-semibold">申请病假 (MC) 需要上传证明吗？</span>
                  </div>
                  <span className="text-xs text-ink-faint">{expandedSection === 'emp-mc' ? '▲ 收起' : '▼ 展开'}</span>
                </button>
                {expandedSection === 'emp-mc' && (
                  <div className="border-t border-line/60 bg-white p-4 text-xs text-ink-soft leading-relaxed space-y-2">
                    <p className="font-medium text-ink">是的，申请 MC 假期的必备规范：</p>
                    <ul className="list-disc list-inside space-y-1 text-ink-faint pl-1">
                      <li>提交病假申请时，必须上传清晰的就诊收据或医生假单（支持 JPG、PNG、PDF）。</li>
                      <li>假单需清楚显示医生签字/诊所盖章、看诊日期与建议休假天数。</li>
                      <li>文件大小上限为 5MB，请确保照片字迹清晰不反光。</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* 模块 3: 年假余额与 Carry Forward */}
              <div className="rounded-xl border border-line bg-surface overflow-hidden">
                <button
                  onClick={() => toggleSection('emp-balance')}
                  className="flex w-full items-center justify-between p-4 text-left font-medium text-sm text-ink hover:bg-paper/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600 text-xs font-bold">3</span>
                    <span className="font-semibold">年假额度 (Entitled) 与结转 (Carry Forward) 如何计算？</span>
                  </div>
                  <span className="text-xs text-ink-faint">{expandedSection === 'emp-balance' ? '▲ 收起' : '▼ 展开'}</span>
                </button>
                {expandedSection === 'emp-balance' && (
                  <div className="border-t border-line/60 bg-white p-4 text-xs text-ink-soft leading-relaxed space-y-2">
                    <div className="p-3 bg-pine-soft/30 rounded-lg border border-pine/20 text-ink">
                      <span className="font-bold text-pine">总可用年假 = 当年法定年假 (Entitlement) + 去年结转 (Carry Forward)</span>
                    </div>
                    <ul className="list-disc list-inside space-y-1 text-ink-faint pl-1">
                      <li>年假额度依据劳动法规及您的入职年限（Service Years）自动梯度增长。</li>
                      <li>在个人工作台的「年假资产卡」中，可随时查看已用天数、审核中天数与剩余可用天数。</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* 模块 4: 申请撤销流程 */}
              <div className="rounded-xl border border-line bg-surface overflow-hidden">
                <button
                  onClick={() => toggleSection('emp-cancel')}
                  className="flex w-full items-center justify-between p-4 text-left font-medium text-sm text-ink hover:bg-paper/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-purple-600 text-xs font-bold">4</span>
                    <span className="font-semibold">如果行程有变，已经批准的假可以撤销吗？</span>
                  </div>
                  <span className="text-xs text-ink-faint">{expandedSection === 'emp-cancel' ? '▲ 收起' : '▼ 展开'}</span>
                </button>
                {expandedSection === 'emp-cancel' && (
                  <div className="border-t border-line/60 bg-white p-4 text-xs text-ink-soft leading-relaxed space-y-2">
                    <p>可以。操作流程如下：</p>
                    <ol className="list-decimal list-inside space-y-1 text-ink-faint pl-1">
                      <li>在个人工作台的请假记录列表（Records）中找到对应的请假单；</li>
                      <li>点击右侧「<span className="text-rust font-medium">Request Cancel</span>」并填写撤销原因；</li>
                      <li>提交后状态将变为「撤销申请中 (Cancellation Requested)」，主管核准后，已扣除的假天数会自动退回您的年假资产。</li>
                    </ol>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ════════ 主管 / HR 管理端指引 ════════ */
            <>
              {/* 管理端 1: 审批流与通知 */}
              <div className="rounded-xl border border-line bg-surface overflow-hidden">
                <button
                  onClick={() => toggleSection('mgr-approve')}
                  className="flex w-full items-center justify-between p-4 text-left font-medium text-sm text-ink hover:bg-paper/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-pine-soft text-pine text-xs font-bold">1</span>
                    <span className="font-semibold">请假审批与 Telegram 实时通知流转</span>
                  </div>
                  <span className="text-xs text-ink-faint">{expandedSection === 'mgr-approve' ? '▲ 收起' : '▼ 展开'}</span>
                </button>
                {expandedSection === 'mgr-approve' && (
                  <div className="border-t border-line/60 bg-white p-4 text-xs text-ink-soft leading-relaxed space-y-3">
                    <p className="text-ink-faint">
                      主管可通过两种途径完成请假与撤销审批：
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-paper rounded-lg border border-line/50">
                        <p className="font-bold text-ink mb-1">网页端审批 (/approve)</p>
                        <p className="text-ink-faint">登录后台在「审批中心」一键查看单据明细、MC 证明原图并点击「Approve」或「Reject」。</p>
                      </div>
                      <div className="p-3 bg-paper rounded-lg border border-line/50">
                        <p className="font-bold text-ink mb-1">Telegram Bot 移动审批</p>
                        <p className="text-ink-faint">在通知设置中绑定 Telegram 账号后，员工提交申请时 Bot 会推送通知，支持手机上快速批复。</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 管理端 2: 兼职工时录入 */}
              <div className="rounded-xl border border-line bg-surface overflow-hidden">
                <button
                  onClick={() => toggleSection('mgr-hours')}
                  className="flex w-full items-center justify-between p-4 text-left font-medium text-sm text-ink hover:bg-paper/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 text-xs font-bold">2</span>
                    <span className="font-semibold">兼职工时录入与失焦自动保存规则 (/work-hours)</span>
                  </div>
                  <span className="text-xs text-ink-faint">{expandedSection === 'mgr-hours' ? '▲ 收起' : '▼ 展开'}</span>
                </button>
                {expandedSection === 'mgr-hours' && (
                  <div className="border-t border-line/60 bg-white p-4 text-xs text-ink-soft leading-relaxed space-y-2">
                    <ul className="list-disc list-inside space-y-1.5 text-ink-faint pl-1">
                      <li><strong className="text-ink">在线表格实时保存</strong>：直接在月份单元格输入工时（支持 0.5 步长），光标移开（失焦）即自动同步至云端数据库。</li>
                      <li><strong className="text-ink">清空或输入 0</strong>：系统将自动清除该员工当月记录，保持报表清爽。</li>
                      <li><strong className="text-ink">本月列智能高亮</strong>：系统会自动为当前自然月添加蓝色标记，方便当月工时汇总核算。</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* 管理端 3: 报表导出与薪酬核对 */}
              <div className="rounded-xl border border-line bg-surface overflow-hidden">
                <button
                  onClick={() => toggleSection('mgr-report')}
                  className="flex w-full items-center justify-between p-4 text-left font-medium text-sm text-ink hover:bg-paper/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-600 text-xs font-bold">3</span>
                    <span className="font-semibold">月度薪资核算与报表导出 (/reports)</span>
                  </div>
                  <span className="text-xs text-ink-faint">{expandedSection === 'mgr-report' ? '▲ 收起' : '▼ 展开'}</span>
                </button>
                {expandedSection === 'mgr-report' && (
                  <div className="border-t border-line/60 bg-white p-4 text-xs text-ink-soft leading-relaxed space-y-2">
                    <p className="text-ink-faint">
                      报表中心提供两个关键视图，专为财务与 HR 算薪设计：
                    </p>
                    <ul className="list-disc list-inside space-y-1.5 text-ink-faint pl-1">
                      <li><strong className="text-ink">Month View (月度明细)</strong>：统计当月无薪假（需扣薪天数）、病假 MC 天数、产假等，并标明「当月合计离岗天数」。</li>
                      <li><strong className="text-ink">Year Balances (年度总账)</strong>：以进度条直观呈现全员年假消耗速度、透支情况与结转剩余。</li>
                      <li><strong className="text-ink">一键导出 CSV</strong>：导出的 CSV 文件内置 UTF-8 编码，用 Excel 打开中文无乱码。</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* 管理端 4: 公休日与工作制 */}
              <div className="rounded-xl border border-line bg-surface overflow-hidden">
                <button
                  onClick={() => toggleSection('mgr-holiday')}
                  className="flex w-full items-center justify-between p-4 text-left font-medium text-sm text-ink hover:bg-paper/40 transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600 text-xs font-bold">4</span>
                    <span className="font-semibold">公休日排班与每周工作日规则 (/holidays)</span>
                  </div>
                  <span className="text-xs text-ink-faint">{expandedSection === 'mgr-holiday' ? '▲ 收起' : '▼ 展开'}</span>
                </button>
                {expandedSection === 'mgr-holiday' && (
                  <div className="border-t border-line/60 bg-white p-4 text-xs text-ink-soft leading-relaxed space-y-2">
                    <p className="text-ink-faint">
                      在每年度初需确认以下两项核心配置，避免请假天数计算偏差：
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-ink-faint pl-1">
                      <li><strong className="text-ink">每周工作日设置</strong>：支持配置周一至周日各自为 1.0天全勤、0.5天半天或休息日（0天）。</li>
                      <li><strong className="text-ink">法定公共假期</strong>：开启后，员工申请年假若跨越公休日，系统将自动排除公休日天数。</li>
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── 底部 Footer ── */}
        <div className="flex items-center justify-between border-t border-line bg-paper/50 px-6 py-3.5">
          <span className="text-xs text-ink-faint">
            如遇系统异常或疑问，请联系人力资源行政部协助。
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-pine px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-pine-deep transition-colors"
          >
            我已知晓
          </button>
        </div>
      </div>
    </div>
  )
}

