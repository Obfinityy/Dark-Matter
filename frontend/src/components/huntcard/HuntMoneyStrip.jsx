// Money strip + budget row — extracted from HuntCard.jsx (P6). Hidden
// for scanner hunts: the rule-based scan spends $0 and has no brain to
// take over, so the money strip and budget controls do not render.
import React from 'react';

export default function HuntMoneyStrip({
  isScanner,
  balance,
  cost,
  budgetUsd,
  spentUsd,
  perIter,
  budgetInput,
  onBudgetInput,
  budgetBusy,
  onSaveBudget,
  huntId,
}) {
  if (isScanner) return null;
  return (
    <>
      <div className="hunt-money-strip" title="Wallet balance, money burnt on this hunt, and burn rate per iteration">
        <span className="hunt-money">💰 {balance === null ? '…' : `$${Number(balance).toFixed(2)}`} balance</span>
        <span className="hunt-money">🔥 ${cost && cost.totalUsd ? cost.totalUsd.toFixed(2) : '0.00'} burnt</span>
        {budgetUsd !== null && (
          <span className="hunt-money" title="Spend cap for this hunt — the hunt auto-pauses at the budget">🎯 Budget ${budgetUsd.toFixed(2)}</span>
        )}
        <span className="hunt-money hunt-burn-rate">⚡ ${perIter.toFixed(2)}/iter</span>
      </div>
      <div className="hunt-budget-row" title="Spend cap for this hunt — at the budget the hunt auto-pauses with a checkpoint; Resume continues from there">
        <label className="hunt-budget-label" htmlFor={`budget-${huntId}`}>Budget $</label>
        <input
          id={`budget-${huntId}`}
          className="hunt-budget-input"
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          placeholder={budgetUsd !== null ? `Current $${budgetUsd.toFixed(2)}` : 'No budget set'}
          value={budgetInput}
          onChange={(e) => onBudgetInput(e.target.value)}
          disabled={budgetBusy}
        />
        <button
          className="btn btn-sm"
          disabled={budgetBusy || budgetInput.trim() === ''}
          onClick={() => onSaveBudget(budgetInput.trim())}
        >
          Set
        </button>
        {budgetUsd !== null && (
          <button className="btn btn-ghost btn-sm" disabled={budgetBusy} onClick={() => onSaveBudget(null)}>
            Clear
          </button>
        )}
        {budgetUsd !== null && (
          <span className="hunt-budget-spent">Spent ${spentUsd.toFixed(2)} of ${budgetUsd.toFixed(2)}</span>
        )}
      </div>
    </>
  );
}
