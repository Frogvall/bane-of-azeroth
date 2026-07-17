export function isPrimaryActiveGM() {
  if (!game.user.isGM) return false;

  const activeGMs = game.users.filter(
    user => user.active && user.isGM
  );
  return activeGMs[0]?.id === game.user.id;
}
