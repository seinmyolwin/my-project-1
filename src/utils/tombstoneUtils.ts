export const createTombstone = (reason: string, userId?: string) => ({
  deletedAt: new Date().toISOString(),
  deletedReason: reason,
  deletedBy: userId,
  updatedAt: new Date().toISOString(),
});
