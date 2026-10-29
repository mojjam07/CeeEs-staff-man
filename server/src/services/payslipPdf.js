import PDFDocument from 'pdfkit';

// Built-in PDF fonts lack the ₦ glyph, so amounts are prefixed "NGN".
const money = (n) => 'NGN ' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function buildPayslipPdf(p) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const L = 50, W = 495;
  const run = p.payroll_runs;

  doc.font('Helvetica-Bold').fontSize(18).fillColor('#111').text(process.env.COMPANY_NAME || 'Company Name', L, 50);
  doc.font('Helvetica').fontSize(10).fillColor('#666')
    .text('PAYSLIP', L, 50, { width: W, align: 'right' })
    .text(`${run.period_start} to ${run.period_end}`, { width: W, align: 'right' });
  doc.moveTo(L, 90).lineTo(L + W, 90).strokeColor('#ccc').stroke();

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#000').text(p.staff.full_name, L, 105);
  doc.font('Helvetica').fontSize(10).fillColor('#444')
    .text([p.staff.position, p.staff.department].filter(Boolean).join(' · ') || ' ')
    .text(`Days present ${p.days_present}/${p.days_scheduled} · Late ${p.days_late} · Leave ${p.days_leave} · Hours ${p.hours_worked}`);

  let y = 170;
  const head = (t) => {
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text(t, L, y); y += 16;
    doc.moveTo(L, y - 2).lineTo(L + W, y - 2).strokeColor('#ddd').stroke(); y += 4;
  };
  const row = (label, amt, bold) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor('#000')
      .text(label, L, y).text(money(amt), L, y, { width: W, align: 'right' });
    y += 18;
  };

  const gross = +p.base_pay + +p.overtime_pay + +p.bonus;
  const ded = +p.absence_deduction + +p.late_deduction + +p.other_deduction + +p.pension_employee + +p.paye_tax;
  head('EARNINGS');
  row('Base pay', p.base_pay); row(`Overtime (${p.overtime_hours}h)`, p.overtime_pay); row('Bonus', p.bonus); row('Gross pay', gross, true);
  y += 10; head('DEDUCTIONS');
  row('Absence', p.absence_deduction); row('Lateness', p.late_deduction); row('Other', p.other_deduction); row('Pension (employee 8%)', p.pension_employee); row('PAYE tax', p.paye_tax); row('Total deductions', ded, true);

  y += 14;
  doc.rect(L, y, W, 36).fill('#f1f5f9');
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(13)
    .text('NET PAY', L + 12, y + 11).text(money(p.net_pay), L, y + 11, { width: W - 12, align: 'right' });

  if (run.status === 'draft') doc.font('Helvetica-Bold').fontSize(60).fillColor('#e5e7eb').text('DRAFT', 150, 420, { rotation: 0 });
  doc.font('Helvetica').fontSize(8).fillColor('#888')
    .text(`Generated ${new Date().toISOString().slice(0, 10)} · Computer-generated payslip`, L, 780, { width: W, align: 'center' });
  return doc;
}
