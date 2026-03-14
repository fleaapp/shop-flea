/**
 * Returns the correct profile route for a given user ID.
 * If the target user is the current user, returns '/profile'.
 * Otherwise returns '/seller/:userId'.
 */
export const getProfileRoute = (targetUserId: string, currentUserId: string | undefined): string => {
  if (currentUserId && targetUserId === currentUserId) {
    return '/profile';
  }
  return `/seller/${targetUserId}`;
};
