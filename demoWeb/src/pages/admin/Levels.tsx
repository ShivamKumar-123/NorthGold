import { useState } from 'react';
import { Save } from 'lucide-react';

import { Alert } from '@/components/ui';
import { num } from '@/lib/format';
import { getLevels, saveLevels } from '@/lib/store';
import type { MlmLevel } from '@/lib/types';

/**
 * The commission ladder.
 *
 * `min_directs` is the unlock rule: a member earns at level N only once they
 * have introduced that many people themselves. Set it to 0 and the level pays
 * from the first referral onward.
 */
export default function AdminLevels() {
  const [levels, setLevels] = useState<MlmLevel[]>(() => getLevels());
  const [message, setMessage] = useState('');

  function edit(level: number, patch: Partial<MlmLevel>) {
    setLevels((list) => list.map((l) => (l.level === level ? { ...l, ...patch } : l)));
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold text-3d sm:text-3xl">MLM levels</h1>
        <p className="mt-1 text-sm text-text-muted">
          What each depth of the referral chain earns, and what unlocks it.
        </p>
      </header>

      <div className="mt-5 space-y-3">
        <Alert kind="info">
          Rates apply to commission paid from now on. Payments already recorded
          keep the rate that was in force when they were made.
        </Alert>
        {message && <Alert kind="success" onDismiss={() => setMessage('')}>{message}</Alert>}
      </div>

      <div className="table-wrap mt-6">
        <table className="data">
          <thead>
            <tr>
              <th>Level</th>
              <th className="text-right">On deposit</th>
              <th className="text-right">On monthly return</th>
              <th className="text-right">Unlocks at</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((l) => (
              <tr key={l.level}>
                <td>
                  <span className="font-medium">L{l.level}</span>
                  <span
                    className={`ml-2 badge ${
                      l.level === 1 ? 'bg-accent/15 text-accent' : 'bg-bronze/15 text-bronze'
                    }`}
                  >
                    {l.level === 1 ? 'direct' : 'indirect'}
                  </span>
                </td>
                <td className="text-right">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={l.deposit_percent}
                    onChange={(e) => edit(l.level, { deposit_percent: Number(e.target.value) })}
                    className="input w-24 px-2 py-1.5 text-right text-xs"
                  />
                </td>
                <td className="text-right">
                  <input
                    type="number"
                    step="0.1"
                    min={0}
                    value={l.roi_percent}
                    onChange={(e) => edit(l.level, { roi_percent: Number(e.target.value) })}
                    className="input w-24 px-2 py-1.5 text-right text-xs"
                  />
                </td>
                <td className="text-right">
                  <input
                    type="number"
                    min={0}
                    value={l.min_directs}
                    onChange={(e) => edit(l.level, { min_directs: Number(e.target.value) })}
                    className="input w-20 px-2 py-1.5 text-right text-xs"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-text-muted">
          A ₹10,000 deposit currently pays{' '}
          <span className="text-success">
            ₹{num(levels.reduce((s, l) => s + (10000 * l.deposit_percent) / 100, 0), 2)}
          </span>{' '}
          across all {levels.length} levels.
        </p>
        <button
          onClick={() => {
            saveLevels(levels);
            setMessage('Levels saved.');
          }}
          className="btn-primary"
        >
          <Save size={15} /> Save levels
        </button>
      </div>
    </div>
  );
}
