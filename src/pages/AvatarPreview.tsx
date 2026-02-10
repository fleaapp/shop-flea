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
import avatarYarn from '@/assets/avatars/yarn.png';

const avatars = [
  { name: 'Button', src: avatarButton },
  { name: '8-Ball', src: avatar8ball },
  { name: 'CD', src: avatarCd },
  { name: 'Vinyl', src: avatarVinyl },
  { name: 'Bowling', src: avatarBowling },
  { name: 'Watch', src: avatarWatch },
  { name: 'Poker Chip', src: avatarPokerChip },
  { name: 'Pearl', src: avatarPearl },
  { name: 'Marble', src: avatarMarble },
  { name: 'Disco Ball', src: avatarDiscoBall },
  { name: 'Coin', src: avatarCoin },
  { name: 'Dartboard', src: avatarDartboard },
  { name: 'Plate', src: avatarPlate },
  { name: 'Golf Ball', src: avatarGolfBall },
  { name: 'Yarn', src: avatarYarn },
];

const AvatarPreview = () => (
  <div className="min-h-screen bg-background p-6">
    <h1 className="text-2xl font-bold text-foreground mb-6">Avatar Preview ({avatars.length} total)</h1>
    <div className="grid grid-cols-3 gap-6">
      {avatars.map((a) => (
        <div key={a.name} className="flex flex-col items-center gap-2">
          <img
            src={a.src}
            alt={a.name}
            className="h-20 w-20 rounded-full object-cover bg-background"
          />
          <span className="text-xs text-muted-foreground">{a.name}</span>
        </div>
      ))}
    </div>
  </div>
);

export default AvatarPreview;
