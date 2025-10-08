import "../../css/BulletIcon.css";

interface BulletIconProps {
  damage: number;
  pulse?: boolean;
}

export const BulletIcon: React.FC<BulletIconProps> = ({ damage, pulse = false }) => (
  <div className={`bullet-icon${pulse ? " bullet-icon--pulse" : ""}`} aria-hidden="true">
    <span className="bullet-icon__value">{damage}</span>
  </div>
);

export default BulletIcon;
