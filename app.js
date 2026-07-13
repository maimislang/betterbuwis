const TAX_TABLE = [
  { min: 0, max: 250000, base: 0, rate: 0 },
  { min: 250000, max: 400000, base: 0, rate: 0.15 },
  { min: 400000, max: 800000, base: 22500, rate: 0.20 },
  { min: 800000, max: 2000000, base: 102500, rate: 0.25 },
  { min: 2000000, max: 8000000, base: 402500, rate: 0.30 },
  { min: 8000000, max: Number.POSITIVE_INFINITY, base: 2202500, rate: 0.35 }
];

function graduatedTax(amount) {
  const taxable = Math.max(Number(amount) || 0, 0);
  const bracket = TAX_TABLE.find(item => taxable <= item.max) || TAX_TABLE[TAX_TABLE.length - 1];
  return bracket.base + Math.max(taxable - bracket.min, 0) * bracket.rate;
}

function peso(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0
  }).format(Math.round(Number(value) || 0));
}

function numberValue(id) {
  const element = document.getElementById(id);
  return element ? Math.max(Number(element.value) || 0, 0) : 0;
}

function setVisible(id, visible) {
  const element = document.getElementById(id);
  if (element) element.classList.toggle('hidden', !visible);
}

function track(eventName, parameters = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, parameters);
  }
}

function updateCalculatorFields() {
  const taxpayerType = document.getElementById('taxpayerType')?.value;
  const method = document.getElementById('taxMethod')?.value;
  const hasCompensation = taxpayerType === 'employee' || taxpayerType === 'mixed';
  const hasBusiness = taxpayerType === 'self' || taxpayerType === 'mixed';

  setVisible('compensationFields', hasCompensation);
  setVisible('businessFields', hasBusiness);
  setVisible('deductionFields', hasBusiness && method === 'itemized');
  setVisible('vatWarning', hasBusiness && document.getElementById('vatStatus')?.value === 'vat');
}

function calculateTax(event) {
  if (event) event.preventDefault();

  const taxpayerType = document.getElementById('taxpayerType').value;
  const method = document.getElementById('taxMethod').value;
  const vatStatus = document.getElementById('vatStatus').value;
  const taxableCompensation = numberValue('taxableCompensation');
  const grossBusiness = numberValue('grossBusiness');
  const itemizedExpenses = numberValue('itemizedExpenses');
  const withheld = numberValue('withheld');
  const quarterlyIncomePaid = numberValue('quarterlyIncomePaid');
  const percentageTaxPaid = numberValue('percentageTaxPaid');

  let businessTaxable = 0;
  let incomeTax = 0;
  let percentageTax = 0;
  let businessMethodText = 'No business income included';

  const hasBusiness = taxpayerType === 'self' || taxpayerType === 'mixed';
  const hasCompensation = taxpayerType === 'employee' || taxpayerType === 'mixed';

  if (hasBusiness && grossBusiness > 0) {
    if (method === '8pct') {
      const eightPercentBase = taxpayerType === 'mixed'
        ? grossBusiness
        : Math.max(grossBusiness - 250000, 0);
      const businessEightPercentTax = eightPercentBase * 0.08;
      incomeTax = graduatedTax(hasCompensation ? taxableCompensation : 0) + businessEightPercentTax;
      businessTaxable = eightPercentBase;
      businessMethodText = taxpayerType === 'mixed'
        ? '8% applied to business gross receipts; the ₱250,000 reduction is not applied to mixed-income business receipts in this estimate.'
        : '8% applied to business gross receipts above ₱250,000.';
    } else {
      businessTaxable = method === 'osd'
        ? grossBusiness * 0.60
        : Math.max(grossBusiness - itemizedExpenses, 0);
      incomeTax = graduatedTax((hasCompensation ? taxableCompensation : 0) + businessTaxable);
      businessMethodText = method === 'osd'
        ? 'Optional Standard Deduction: 40% of gross receipts treated as deduction.'
        : 'Itemized deductions limited here to the amount entered; actual deductibility depends on records and tax rules.';
      if (vatStatus === 'nonvat') {
        percentageTax = grossBusiness * 0.03;
      }
    }
  } else {
    incomeTax = graduatedTax(hasCompensation ? taxableCompensation : 0);
  }

  const incomeCredits = withheld + quarterlyIncomePaid;
  const incomeBalance = incomeTax - incomeCredits;
  const percentageBalance = Math.max(percentageTax - percentageTaxPaid, 0);
  const totalPositiveBalance = Math.max(incomeBalance, 0) + percentageBalance;
  const possibleIncomeCredit = Math.max(-incomeBalance, 0);

  const result = document.getElementById('calculatorResult');
  const statusClass = totalPositiveBalance > 0 ? 'red' : possibleIncomeCredit > 0 ? 'green' : 'gold';
  const headline = totalPositiveBalance > 0
    ? 'Estimated balance still payable'
    : possibleIncomeCredit > 0
      ? 'Possible overpayment or tax credit'
      : 'No estimated balance after entered credits';

  const vatNote = vatStatus === 'vat' && hasBusiness
    ? '<div class="notice warn"><strong>VAT is not included.</strong> A reliable VAT result needs output VAT, allowable input VAT, timing, and invoice details. Use this only for the income-tax portion.</div>'
    : '';

  const filingNote = taxpayerType === 'employee'
    ? '<li>One-employer employees with correct withholding may qualify for substituted filing. This tool does not determine that status.</li>'
    : '<li>Registration, return type, and filing frequency depend on your BIR registration and actual activities.</li>';

  result.innerHTML = `
    <div class="result-list" aria-live="polite">
      <div class="result-item ${statusClass}"><span>${headline}</span><strong>${peso(totalPositiveBalance || possibleIncomeCredit)}</strong></div>
      <div class="result-item"><span>Estimated income tax before credits</span><strong>${peso(incomeTax)}</strong></div>
      <div class="result-item"><span>Income-tax credits entered</span><strong>${peso(incomeCredits)}</strong></div>
      ${percentageTax > 0 ? `<div class="result-item"><span>Estimated 3% percentage tax before payments</span><strong>${peso(percentageTax)}</strong></div>` : ''}
      ${percentageTax > 0 ? `<div class="result-item"><span>Estimated unpaid percentage tax</span><strong>${peso(percentageBalance)}</strong></div>` : ''}
    </div>
    <ul class="assumptions">
      <li>${businessMethodText}</li>
      ${filingNote}
      <li>A negative income-tax balance is shown only as a possible credit or overpayment—not an automatic cash refund.</li>
      <li>Penalties, compromise amounts, VAT, local taxes, withholding obligations, and special tax regimes are not included.</li>
      <li>Amounts stay in your browser. BetterBuwis does not transmit your tax figures.</li>
    </ul>
    ${vatNote}
    <div class="notice" style="margin-top:1rem"><strong>Next step:</strong> Compare this estimate with your BIR registration, forms, certificates, and official filing records. For back taxes, notices, VAT, or mixed records, ask a licensed CPA to verify the result.</div>
  `;

  track('calculator_completed', {
    taxpayer_type: taxpayerType,
    method,
    has_positive_balance: totalPositiveBalance > 0
  });
}

function initCalculator() {
  const form = document.getElementById('taxCalculator');
  if (!form) return;
  ['taxpayerType', 'taxMethod', 'vatStatus'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updateCalculatorFields);
  });
  form.addEventListener('submit', calculateTax);
  updateCalculatorFields();
}

document.addEventListener('DOMContentLoaded', initCalculator);