export interface WeaponConfig {
  id: number;
  label: string;
  damage: number;
  speed: number;
  maxDistance: number;
  radius: number;
  color: string;
  flashIntensity: number;
}

export const weaponConfigs: WeaponConfig[] = [
  {
    id: 0,
    label: "Strength I",
    damage: 100,
    speed: 26,
    maxDistance: 18,
    radius: 0.16,
    color: "#d0d0d0",
    flashIntensity: 3.2,
  },
  {
    id: 1,
    label: "Strength II",
    damage: 200,
    speed: 28,
    maxDistance: 20,
    radius: 0.18,
    color: "#b8b8b8",
    flashIntensity: 3.5,
  },
  {
    id: 2,
    label: "Strength III",
    damage: 300,
    speed: 30,
    maxDistance: 22,
    radius: 0.19,
    color: "#a0a0a0",
    flashIntensity: 3.9,
  },
  {
    id: 3,
    label: "Strength IV",
    damage: 400,
    speed: 32,
    maxDistance: 24,
    radius: 0.21,
    color: "#8a8a8a",
    flashIntensity: 4.4,
  },
  {
    id: 4,
    label: "Strength V",
    damage: 500,
    speed: 34,
    maxDistance: 26,
    radius: 0.22,
    color: "#f0f0f0",
    flashIntensity: 4.8,
  },
  {
    id: 5,
    label: "Strength VI",
    damage: 600,
    speed: 36,
    maxDistance: 28,
    radius: 0.23,
    color: "#ffffff",
    flashIntensity: 5.2,
  },
];

export const getWeaponConfig = (level: number): WeaponConfig => {
  if (weaponConfigs.length === 0) {
    throw new Error("weaponConfigs is empty");
  }
  const clamped = Math.max(0, Math.min(level, weaponConfigs.length - 1));
  return weaponConfigs[clamped];
};
