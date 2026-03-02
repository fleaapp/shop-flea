import avatarButton from '@/assets/avatars/button.png';
import avatar8ball from '@/assets/avatars/8ball.png';
import avatarCd from '@/assets/avatars/cd.png';
import avatarVinyl from '@/assets/avatars/vinyl.png';
import avatarBowling from '@/assets/avatars/bowling.png';
import avatarWatch from '@/assets/avatars/watch.png';
import avatarPokerChip from '@/assets/avatars/poker-chip.png';
import avatarPearl from '@/assets/avatars/pearl.png';
import avatarMarble from '@/assets/avatars/marble.png';
import avatarDiscoBall from '@/assets/avatars/disco-ball.png';
import avatarCoin from '@/assets/avatars/coin.png';
import avatarDartboard from '@/assets/avatars/dartboard.png';
import avatarPlate from '@/assets/avatars/plate.png';
import avatarGolfBall from '@/assets/avatars/golf-ball.png';

const DEFAULT_AVATARS = [
  avatarButton,
  avatar8ball,
  avatarCd,
  avatarVinyl,
  avatarBowling,
  avatarWatch,
  avatarPokerChip,
  avatarPearl,
  avatarMarble,
  avatarDiscoBall,
  avatarCoin,
  avatarDartboard,
  avatarPlate,
  avatarGolfBall,
];

/**
 * Returns a deterministic default avatar based on a seed string (e.g. user ID).
 * The same seed always produces the same avatar.
 */
export const getDefaultAvatar = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % DEFAULT_AVATARS.length;
  return DEFAULT_AVATARS[index];
};
