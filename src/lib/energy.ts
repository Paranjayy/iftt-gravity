import { RuleAction } from './rules/types';

export const DEVICE_KW = { ac: 1.65, light: 0.012 };

export function calculatePgvclBill(units: number, includeFixed = true) {
  let energyCharge = 0;
  if (units <= 50) energyCharge = units * 3.05;
  else if (units <= 100) energyCharge = (50 * 3.05) + (units - 50) * 3.50;
  else if (units <= 250) energyCharge = (50 * 3.05) + (50 * 3.50) + (units - 100) * 4.10;
  else energyCharge = (50 * 3.05) + (50 * 3.50) + (150 * 4.10) + (units - 250) * 4.60;

  const fpppa = units * 2.85;
  const fixed = includeFixed ? 35 : 0;
  const subtotal = energyCharge + fpppa + fixed;
  const duty = subtotal * 0.15;
  return (subtotal + duty).toFixed(2);
}

export function deviceKw(deviceId: string): number {
  if (deviceId.startsWith('mir:')) return DEVICE_KW.ac;
  if (deviceId.startsWith('wiz:') || deviceId.startsWith('light')) return DEVICE_KW.light;
  return 0;
}

export function estimateSceneCostPerHour(actions: RuleAction[]): { kw: number; rupeesPerHour: number } {
  let kw = 0;
  for (const a of actions) {
    if (a.kind === 'device') kw += deviceKw(a.deviceId);
    else if (a.kind === 'scene') kw += DEVICE_KW.ac + DEVICE_KW.light;
  }
  return { kw, rupeesPerHour: Number(calculatePgvclBill(kw, false)) };
}
