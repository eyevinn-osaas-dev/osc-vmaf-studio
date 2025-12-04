import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface VmafResult {
  jobId: string;
  status: string;
  vmafScore: number;
  frames: Array<{ frameNum: number; [key: string]: number }>;
  vmafMetrics: Record<string, {
    min: number;
    max: number;
    mean: number;
    harmonic_mean: number;
  }>;
  primaryMetric: string;
}

interface ResultsViewerProps {
  results: VmafResult;
}

// Color palette for different metrics
const COLORS = [
  '#60A5FA', // blue
  '#34D399', // green
  '#F87171', // red
  '#FBBF24', // yellow
  '#A78BFA', // purple
  '#FB923C', // orange
];

function ResultsViewer({ results }: ResultsViewerProps) {
  const metricKeys = Object.keys(results.vmafMetrics);

  return (
    <div className="space-y-6">
      {/* All Metrics Statistics */}
      <div className="space-y-4">
        <p className="text-sm font-semibold text-gray-300">All VMAF Metrics</p>
        <div className="grid grid-cols-1 gap-3">
          {metricKeys.map((metricKey) => {
            const stats = results.vmafMetrics[metricKey];
            return (
              <div key={metricKey} className="bg-gray-700 p-3 rounded">
                <p className="text-sm font-medium text-gray-300 mb-2">{metricKey}</p>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400">Min:</span>{' '}
                    <span className="text-white">{stats.min.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Max:</span>{' '}
                    <span className="text-white">{stats.max.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Mean:</span>{' '}
                    <span className="text-white">{stats.mean.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Harmonic:</span>{' '}
                    <span className="text-white">{stats.harmonic_mean.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Frame Chart with all metrics */}
      <div>
        <p className="text-sm text-gray-400 mb-2">Per-Frame VMAF</p>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={results.frames}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="frameNum"
                stroke="#9CA3AF"
                fontSize={12}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#9CA3AF"
                fontSize={12}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1F2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: '#9CA3AF' }}
              />
              {metricKeys.map((metricKey, index) => (
                <Line
                  key={metricKey}
                  type="monotone"
                  dataKey={metricKey}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={metricKey === results.primaryMetric ? 3 : 1.5}
                  dot={false}
                  name={metricKey}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap gap-3 mt-2">
          {metricKeys.map((metricKey, index) => (
            <div key={metricKey} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="text-xs text-gray-400">
                {metricKey}
                {metricKey === results.primaryMetric && ' (primary)'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ResultsViewer;
