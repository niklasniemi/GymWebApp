import { useState } from 'react';
import { OneRepMax } from '../components/tools/OneRepMax';
import { PlateCalculator } from '../components/tools/PlateCalculator';
import { WarmupPlanner } from '../components/tools/WarmupPlanner';
import { Card, PageHeader } from '../components/ui/primitives';
import { Segmented } from '../components/ui/Segmented';
import { SwitchRow } from '../components/ui/Switch';
import { useSettings } from '../store/settings';
import { navigate, useSubRoute } from '../store/ui';

type Tool = 'plates' | 'warmup' | '1rm';

const TOOLS: Tool[] = ['plates', 'warmup', '1rm'];

export default function UtilitiesPage() {
  const [sub] = useSubRoute();
  const tool: Tool = TOOLS.includes(sub as Tool) ? (sub as Tool) : 'plates';
  const setTool = (t: Tool) => navigate('utilities', t === 'plates' ? undefined : t, undefined, { replace: true });
  const unit = useSettings((s) => s.unit);
  const [barbell, setBarbell] = useState(true);

  return (
    <div className="space-y-4 pb-6">
      <PageHeader title="Utilities" subtitle="Gym math" />
      <Segmented
        label="Tool"
        value={tool}
        onChange={setTool}
        options={[
          { value: 'plates', label: 'Plates' },
          { value: 'warmup', label: 'Warm-up' },
          { value: '1rm', label: '1RM' },
        ]}
      />
      {tool === 'plates' && <PlateCalculator />}
      {tool === 'warmup' && (
        <Card className="space-y-2">
          <SwitchRow
            checked={barbell}
            onChange={setBarbell}
            label="Barbell lift"
            description={`Round to loadable plates on a ${unit === 'kg' ? '20 kg' : '45 lb'} bar`}
          />
          <WarmupPlanner key={`${unit}-${barbell}`} unit={unit} barbell={barbell} />
        </Card>
      )}
      {tool === '1rm' && <OneRepMax key={unit} />}
    </div>
  );
}
