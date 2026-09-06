import { Link } from 'react-router-dom';
import { Banknote, Settings as SettingsIcon } from 'lucide-react';

import { Alert } from '@/components/ui';
import { money } from '@/lib/format';
import { cashChannel } from '@/lib/queries';

/**
 * The cash counter.
 *
 * Read-only on purpose: everything it shows comes from the support settings,
 * and duplicating the edit form here would give the same fact two places to be
 * changed and one of them to be forgotten.
 */
export default function AdminChannels() {
  const channel = cashChannel();

  const rows: Array<[string, string]> = [
    ['Contact', channel.contact_person],
    ['Phone', channel.contact_phone],
    ['Address', channel.office_address],
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold text-3d sm:text-3xl">Cash counter</h1>
        <p className="mt-1 text-sm text-text-muted">
          Where members are told to hand over their deposits.
        </p>
      </header>

      <div className="mt-5">
        <Alert kind="info">
          Cash is the only settlement route on this platform. Bank, UPI and
          crypto exist in the data model but nothing in the product offers them.
        </Alert>
      </div>

      <div className="card mt-6 p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/30 bg-accent/10 text-accent shadow-e1">
            <Banknote size={19} />
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold text-text">{channel.name}</h2>
            <p className="mt-0.5 text-xs text-text-muted">
              Minimum {money(channel.min_amount).replace('.00', '')}
            </p>
          </div>
        </div>

        <dl className="mt-5 space-y-2.5 border-t border-border pt-4 text-sm">
          {rows.map(([key, value]) => (
            <div key={key} className="flex justify-between gap-6">
              <dt className="shrink-0 text-text-muted">{key}</dt>
              <dd className="text-right text-text">{value}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-text-muted">
          {channel.instructions}
        </p>
      </div>

      <Link to="/admin/settings" className="btn-ghost mt-5">
        <SettingsIcon size={15} /> Edit these details in Settings
      </Link>
    </div>
  );
}
