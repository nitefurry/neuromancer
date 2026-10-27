import { dayKeysBack } from './store.js';

export function buildMetrics(db) {
  const days14 = dayKeysBack(14);
  const days30 = dayKeysBack(30);
  const today = days14[days14.length - 1];

  const tokenByDay = days14.map((date) => ({
    date,
    tokens: db.usage.filter((u) => u.date === date).reduce((sum, u) => sum + u.tokens, 0),
  }));
  const tokensToday = tokenByDay[tokenByDay.length - 1]?.tokens || 0;
  const tokens7d = db.usage
    .filter((u) => days14.slice(-7).includes(u.date))
    .reduce((sum, u) => sum + u.tokens, 0);
  const tokens30d = db.usage
    .filter((u) => days30.includes(u.date))
    .reduce((sum, u) => sum + u.tokens, 0);

  const ongoingStatuses = ['todo', 'in_progress', 'review'];
  const tasksOngoing = db.tasks.filter((t) => ongoingStatuses.includes(t.status));
  const needsApproval = db.missions.filter((m) => m.status === 'pending_review');

  const shareBase = db.usage
    .filter((u) => days30.includes(u.date))
    .reduce((sum, u) => sum + u.tokens, 0);

  const agentRows = db.agents.map((agent) => {
    const monthly = db.usage
      .filter((u) => u.agentId === agent.id && days30.includes(u.date))
      .reduce((sum, u) => sum + u.tokens, 0);
    const counts = {};
    days30.forEach((date) => {
      counts[date] = db.activity.filter(
        (a) => a.agentId === agent.id && a.date === date,
      ).length;
    });
    return {
      agentId: agent.id,
      name: agent.name,
      role: agent.role,
      status: agent.status,
      tokens30d: monthly,
      tokens7d: db.usage
        .filter((u) => u.agentId === agent.id && days14.slice(-7).includes(u.date))
        .reduce((sum, u) => sum + u.tokens, 0),
      share: shareBase ? Math.round((monthly / shareBase) * 100) : 0,
      activity: counts,
      events7d: Object.entries(counts)
        .filter(([date]) => days14.slice(-7).includes(date))
        .reduce((sum, [, n]) => sum + n, 0),
      events30d: Object.values(counts).reduce((sum, n) => sum + n, 0),
    };
  });

  const events = [
    ...db.activity
      .slice(-40)
      .map((a) => ({
        id: a.id,
        at: a.at,
        type: a.kind,
        label: a.label,
        agentId: a.agentId,
        agentName: db.agents.find((x) => x.id === a.agentId)?.name || 'Agent',
      })),
    ...db.events.map((e) => ({
      id: e.id,
      at: e.at,
      type: e.type,
      label: e.message,
      agentId: null,
      agentName: 'Sistem',
    })),
  ]
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 12);

  const missionCounts = db.missions.reduce((acc, mission) => {
    acc[mission.status] = (acc[mission.status] || 0) + 1;
    return acc;
  }, {});

  return {
    tokenByDay,
    tokensToday,
    tokens7d,
    tokens30d,
    tasksOngoing,
    needsApproval,
    agentRows,
    days30,
    days14,
    today,
    events,
    missionCounts,
    totals: {
      agents: db.agents.length,
      agentsActive: db.agents.filter((a) => a.status === 'active').length,
      missions: db.missions.length,
      brands: db.brands.length,
      docs: db.docs.length,
      chats: db.chats.length,
      pendingReview: needsApproval.length,
      tasksByStatus: db.tasks.reduce((acc, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {}),
    },
  };
}
