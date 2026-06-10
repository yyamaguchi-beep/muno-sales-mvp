const memory = {
  reports: [],
  sessions: new Map(),
};

export function saveReport(report) {
  const item = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...report,
  };

  memory.reports.push(item);
  return item;
}

export function getReports() {
  return memory.reports;
}

export function getReportById(id) {
  return memory.reports.find((report) => report.id === id) || null;
}

export function saveSession(key, value) {
  memory.sessions.set(key, {
    value,
    updatedAt: new Date().toISOString(),
  });

  return value;
}

export function getSession(key) {
  return memory.sessions.get(key)?.value || null;
}

export function deleteSession(key) {
  memory.sessions.delete(key);
}

export const storage = {
  saveReport,
  getReports,
  getReportById,
  saveSession,
  getSession,
  deleteSession,
};
