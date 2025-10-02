// pages/test-supabase.tsx
'use client';

import { useEffect, useState } from 'react';
import { getBrowserClient } from '../lib/supabase/client';

export default function TestSupabasePage() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const supabase = getBrowserClient();
      const { data, error } = await supabase.from('vendors').select('*');
      if (error) {
        setError(error.message);
      } else {
        setVendors(data || []);
      }
    };

    fetchData();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Supabase 接続テスト</h1>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {vendors.length > 0 ? (
        <ul>
          {vendors.map((vendor) => (
            <li key={vendor.id}>
              {vendor.name} ({vendor.contact_email})
            </li>
          ))}
        </ul>
      ) : (
        <p>データがありません</p>
      )}
    </div>
  );
}
