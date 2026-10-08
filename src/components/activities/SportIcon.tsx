import type { SVGProps } from 'react';
import {
  Bike,
  CircleDot,
  Dumbbell,
  Flower2,
  Footprints,
  HandFist,
  LandPlot,
  Mountain,
  MountainSnow,
  Music,
  PersonStanding,
  Sailboat,
  Snowflake,
  Volleyball,
  Waves,
  type LucideIcon,
} from 'lucide-react';
import type { Sport } from '../../types';

type IconProps = { size?: number; className?: string; strokeWidth?: number } & Omit<SVGProps<SVGSVGElement>, 'ref'>;

/** Racket (Lucide has none): strung head + handle, drawn in Lucide's style. */
function Racket({ size = 24, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <ellipse cx="14.5" cy="9.5" rx="6" ry="6.5" transform="rotate(45 14.5 9.5)" />
      <path d="M10.3 13.7 4 20" />
      <path d="M11.5 6.5l6 6M14.5 4.8l4.7 4.7M9.8 9l5.2 5.2" opacity="0.55" />
    </svg>
  );
}

/** Paddle (padel): solid face with holes + short handle. */
function Paddle({ size = 24, strokeWidth = 2, ...rest }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      <path d="M8.6 15.4c-2.7-2.7-2.6-7.3.4-10.2s7.5-3.1 10.2-.4.6 7.4-2.3 10.3-7.6 3-8.3.3Z" />
      <path d="M8.6 15.4 4 20" />
      <circle cx="12" cy="9" r="0.6" fill="currentColor" />
      <circle cx="15" cy="7" r="0.6" fill="currentColor" />
      <circle cx="15" cy="11" r="0.6" fill="currentColor" />
    </svg>
  );
}

type SportIconComponent = LucideIcon | ((props: IconProps) => React.JSX.Element);

const SPORT_ICONS: Record<Sport, SportIconComponent> = {
  tennis: Racket,
  padel: Paddle,
  badminton: Racket,
  squash: Racket,
  tableTennis: Paddle,
  football: CircleDot,
  basketball: CircleDot,
  floorball: CircleDot,
  iceHockey: Snowflake,
  volleyball: Volleyball,
  golf: LandPlot,
  cycling: Bike,
  swimming: Waves,
  walking: Footprints,
  hiking: Mountain,
  skiing: MountainSnow,
  rowing: Sailboat,
  climbing: Mountain,
  martialArts: HandFist,
  yoga: Flower2,
  dance: Music,
  other: PersonStanding,
};

export function SportIcon({ sport, ...props }: { sport: Sport } & IconProps) {
  const Icon = SPORT_ICONS[sport] ?? Dumbbell;
  return <Icon {...props} />;
}
