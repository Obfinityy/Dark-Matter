import React from 'react';
import { Card, CardHeader, CardContent, CardValue } from '../../components/ui/Card';
import { Button } from '../../components/ui/Basic';
import { EmptyState } from '../../components/ui/EmptyState';
import { CreditCard, WalletCards } from 'lucide-react';

export const Billing = () => {
  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Wallet & Billing</h1>
          <p className="page-description">Manage your funds and usage.</p>
        </div>
        <Button variant="primary"><WalletCards size={16} /> Add Funds</Button>
      </div>

      <div className="grid grid-cols-3" style={{ marginBottom: 32 }}>
        <Card>
          <CardHeader title="Available Balance" />
          <CardContent>
            <CardValue value="--" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Promotional Balance" />
          <CardContent>
            <CardValue value="--" />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 8 }}>No promotional balance</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Usage This Month" />
          <CardContent>
            <CardValue value="--" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Transactions" />
        <CardContent>
          <EmptyState title="No transactions yet" description="Billing activity will appear here when usage and payments are connected." icon={CreditCard} />
        </CardContent>
      </Card>
    </div>
  );
};
