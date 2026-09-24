import React, { useEffect } from "react";
import { X, BarChart3, TrendingUp, Users, Bot, Zap, CheckCircle2, AlertCircle } from "lucide-react";
import useBusinessStore from "../../store/useBusinessStore";

const BusinessAnalyticsModal = ({ isOpen, onClose }) => {
  const currentOrg = useBusinessStore((s) => s.currentOrg);
  const overviewAnalytics = useBusinessStore((s) => s.overviewAnalytics);
  const teamPerformance = useBusinessStore((s) => s.teamPerformance);
  const isLoadingAnalytics = useBusinessStore((s) => s.isLoadingAnalytics);
  const loadAnalytics = useBusinessStore((s) => s.loadAnalytics);

  useEffect(() => {
    if (isOpen && currentOrg) {
      loadAnalytics();
    }
  }, [isOpen, currentOrg, loadAnalytics]);

  if (!isOpen) return null;

  const overview = overviewAnalytics?.overview || {};
  const priority = overviewAnalytics?.priorityDistribution || {};
  const ai = overviewAnalytics?.aiMetrics || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-[#161616] border border-slate-200 dark:border-[#262626] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#222222]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-[#FF6B00]/10 text-[#FF6B00]">
              <BarChart3 size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                Business Analytics & Performance
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#A0A0A0]">
                {currentOrg?.name || "Organization"} • Real-Time Metrics & SLA Tracking
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#222222] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoadingAnalytics ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-8 h-8 border-3 border-slate-300 dark:border-[#222222] border-t-[#FF6B00] rounded-full animate-spin" />
              <p className="text-sm">Aggregating workspace analytics...</p>
            </div>
          ) : (
            <>
              {/* Top KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1c1c1c] border border-slate-100 dark:border-[#262626]">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Total Chats</span>
                    <TrendingUp size={16} className="text-[#FF6B00]" />
                  </div>
                  <div className="text-2xl font-black text-slate-800 dark:text-white">
                    {overview.totalConversations || 0}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#888888] mt-1">
                    {overview.customersCount || 0} unique customers
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1c1c1c] border border-slate-100 dark:border-[#262626]">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Active Tickets</span>
                    <AlertCircle size={16} className="text-amber-500" />
                  </div>
                  <div className="text-2xl font-black text-amber-500">
                    {overview.activeConversations || 0}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#888888] mt-1">
                    {overview.urgentTickets || 0} urgent tickets
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1c1c1c] border border-slate-100 dark:border-[#262626]">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">Resolution Rate</span>
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  </div>
                  <div className="text-2xl font-black text-emerald-500">
                    {overview.resolutionRate || 0}%
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#888888] mt-1">
                    {overview.resolvedConversations || 0} resolved
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#1c1c1c] border border-slate-100 dark:border-[#262626]">
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider">AI Operations</span>
                    <Bot size={16} className="text-[#FF6B00]" />
                  </div>
                  <div className="text-2xl font-black text-[#FF6B00]">
                    {ai.requestsCount || 0}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-[#888888] mt-1">
                    {(ai.tokensUsed || 0).toLocaleString()} tokens used
                  </div>
                </div>
              </div>

              {/* Priority & AI Costs Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Priority Breakdown */}
                <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#1c1c1c] border border-slate-100 dark:border-[#262626]">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-3">
                    Ticket Priority Distribution
                  </h3>
                  <div className="space-y-2.5">
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-red-500 font-semibold">Urgent</span>
                        <span className="font-bold text-slate-700 dark:text-white">{priority.urgent || 0}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-[#262626] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-500"
                          style={{
                            width: `${overview.totalConversations ? ((priority.urgent || 0) / overview.totalConversations) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-amber-500 font-semibold">High</span>
                        <span className="font-bold text-slate-700 dark:text-white">{priority.high || 0}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-[#262626] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500"
                          style={{
                            width: `${overview.totalConversations ? ((priority.high || 0) / overview.totalConversations) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-blue-500 font-semibold">Medium</span>
                        <span className="font-bold text-slate-700 dark:text-white">{priority.medium || 0}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-[#262626] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{
                            width: `${overview.totalConversations ? ((priority.medium || 0) / overview.totalConversations) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-emerald-500 font-semibold">Low</span>
                        <span className="font-bold text-slate-700 dark:text-white">{priority.low || 0}</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-[#262626] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500"
                          style={{
                            width: `${overview.totalConversations ? ((priority.low || 0) / overview.totalConversations) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* AI Token & Cost Control */}
                <div className="p-5 rounded-xl bg-slate-50 dark:bg-[#1c1c1c] border border-slate-100 dark:border-[#262626]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                      AI Token Quota & Cost Guardrail
                    </h3>
                    <Zap size={16} className="text-[#FF6B00]" />
                  </div>
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1 text-slate-600 dark:text-[#A0A0A0]">
                      <span>Monthly Quota Usage</span>
                      <span>
                        {(ai.tokensUsed || 0).toLocaleString()} / {(ai.tokensQuota || 200000).toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-[#262626] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#FF6B00]"
                        style={{
                          width: `${Math.min(100, ((ai.tokensUsed || 0) / (ai.tokensQuota || 200000)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-white dark:bg-[#111111] border border-slate-200 dark:border-[#262626] text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Estimated API Cost:</span>
                      <span className="font-bold text-emerald-500">${ai.estimatedCostUSD || "0.0000"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Active Model Provider:</span>
                      <span className="font-semibold text-slate-700 dark:text-white">Google Gemini 3.8 Flash</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Team Performance Table */}
              <div className="rounded-xl bg-slate-50 dark:bg-[#1c1c1c] border border-slate-100 dark:border-[#262626] overflow-hidden">
                <div className="px-5 py-3 border-b border-slate-200 dark:border-[#262626] flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <Users size={16} className="text-[#FF6B00]" />
                    Team Member Performance
                  </h3>
                  <span className="text-xs text-slate-500">
                    {teamPerformance.length} Active Agents
                  </span>
                </div>
                {teamPerformance.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No assigned ticket data available yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 dark:bg-[#161616] text-slate-500 dark:text-[#A0A0A0] uppercase tracking-wider font-semibold">
                        <tr>
                          <th className="px-4 py-2.5">Agent</th>
                          <th className="px-4 py-2.5">Total Assigned</th>
                          <th className="px-4 py-2.5">Resolved</th>
                          <th className="px-4 py-2.5">In Progress</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-[#262626]">
                        {teamPerformance.map((agent) => (
                          <tr key={agent.agentId} className="hover:bg-slate-100/50 dark:hover:bg-[#202020]/50">
                            <td className="px-4 py-3 flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#FF6B00] text-white flex items-center justify-center font-bold text-[10px]">
                                {(agent.agentName || agent.username || "A").charAt(0).toUpperCase()}
                              </div>
                              <span className="font-semibold text-slate-800 dark:text-white">
                                {agent.agentName || agent.username}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-700 dark:text-white">{agent.totalAssigned}</td>
                            <td className="px-4 py-3 text-emerald-500 font-bold">{agent.resolved}</td>
                            <td className="px-4 py-3 text-amber-500 font-bold">{agent.open}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BusinessAnalyticsModal;
