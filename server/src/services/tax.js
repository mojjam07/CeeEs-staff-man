import { round2 } from '../util.js';

// Nigeria Tax Act 2025 (effective 1 Jan 2026), Fourth Schedule: [band width, rate]
const BANDS = [[800000, 0], [2200000, 0.15], [9000000, 0.18], [13000000, 0.21], [25000000, 0.23], [Infinity, 0.25]];
const PER = Number(process.env.PAYROLL_PERIODS_PER_YEAR || 12);
const MIN_WAGE = Number(process.env.MINIMUM_WAGE || 70000);
const PENSION_EMPLOYEE = 0.08, PENSION_EMPLOYER = 0.10; // Pension Reform Act 2014 minimums
const RENT_RELIEF_RATE = 0.2, RENT_RELIEF_CAP = 500000;

export function annualTax(chargeable) {
  let left = Math.max(0, chargeable), tax = 0;
  for (const [width, rate] of BANDS) {
    const part = Math.min(left, width);
    tax += part * rate; left -= part;
    if (left <= 0) break;
  }
  return tax;
}

// earned = this period's taxable gross (base + overtime + bonus - absence/late deductions)
// pensionable = pensionable pay for the period (null -> base)
export function statutory({ earned, base, pensionable, annualRent, pensionEnabled = true }) {
  const basis = pensionable === null || pensionable === undefined || pensionable === '' ? base : Number(pensionable);
  const cap = Math.max(0, earned); // never deduct pension from pay that wasn't earned
  const pensionable_ = Math.min(basis, cap);
  const pensionEmployee = pensionEnabled ? round2(pensionable_ * PENSION_EMPLOYEE) : 0;
  const pensionEmployer = pensionEnabled ? round2(pensionable_ * PENSION_EMPLOYER) : 0;
  const rentRelief = Math.min(RENT_RELIEF_RATE * Number(annualRent || 0), RENT_RELIEF_CAP);
  const annualGross = earned * PER;
  let paye = 0;
  if (annualGross > MIN_WAGE * 12) paye = annualTax(annualGross - pensionEmployee * PER - rentRelief) / PER; // min-wage earners are exempt
  return { pensionEmployee, pensionEmployer, paye: round2(paye), rentRelief };
}
