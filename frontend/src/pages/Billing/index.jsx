import React, { useState } from 'react';
import { Card, CardHeader, CardContent, CardValue } from '../../components/ui/Card';
import { Badge, Button } from '../../components/ui/Basic';
import { mockTransactions } from '../../mock/transactions';

export const Billing = () => {
  const [activeTab, setActiveTab] = useState('transactions');

  return (
    <div className="animate-fade-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Wallet & Billing</h1>
          <p className="page-description">Manage your funds and usage.</p>
        </div>
        <Button variant="primary">Add Funds</Button>
      </div>

      <div className="grid grid-cols-3" style={{ marginBottom: 32 }}>
        <Card>
          <CardHeader title="Available Balance" />
          <CardContent>
            <CardValue value="$150.00" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Promotional Balance" />
          <CardContent>
            <CardValue value="$25.00" />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 8 }}>Expires in 12 days</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Usage This Month" />
          <CardContent>
            <CardValue value="$12.40" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title="Transactions" />
        <CardContent>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Type</th>
                  <th>Service</th>
                  <th>Reference</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {mockTransactions.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ color: 'var(--text-secondary)' }}>{tx.timestamp}</td>
                    <td><Badge variant={tx.type === 'Credit' ? 'success' : 'neutral'}>{tx.type}</Badge></td>
                    <td>{tx.service}</td>
                    <td style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{tx.reference}</td>
                    <td style={{ fontWeight: 600, color: tx.type === 'Credit' ? 'var(--success)' : 'var(--text-primary)' }}>{tx.amount}</td>
                    <td><Badge variant="success">{tx.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
