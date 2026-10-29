import { useState } from 'react';
import { useApi } from '../lib/api';

export default function Audit() {
  const [entity, setEntity] = useState('');
  const { data, error } = useApi('/audit' + (entity ? '?entity=' + entity : ''));
  return (
    <>
      <h1>Audit log</h1>
      <p>Show <select value={entity} onChange={(e) => setEntity(e.target.value)}>
        <option value="">Everything</option>{['staff', 'shifts', 'attendance', 'payroll', 'leave'].map((x) => <option key={x}>{x}</option>)}
      </select> (latest 200 changes)</p>
      {error && <p className="err">{error}</p>}
      <div className="scroll"><table>
        <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
        <tbody>{data?.map((a) => (
          <tr key={a.id}><td>{new Date(a.at).toLocaleString()}</td><td>{a.actor_email}</td><td>{a.action}</td>
            <td><small>{a.details && Object.keys(a.details).length ? JSON.stringify(a.details).slice(0, 140) : ''}</small></td></tr>
        ))}</tbody>
      </table></div>
    </>
  );
}
