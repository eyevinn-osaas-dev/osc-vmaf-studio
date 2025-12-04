interface UploadedFile {
  key: string;
  name: string;
  size: number;
}

interface AnalysisPanelProps {
  referenceFile?: UploadedFile;
  distortedFile?: UploadedFile;
  onAnalyze: () => void;
}

function AnalysisPanel({
  referenceFile,
  distortedFile,
  onAnalyze,
}: AnalysisPanelProps) {
  const canAnalyze = referenceFile && distortedFile;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          <div className="flex-1">
            <p className="text-sm text-gray-400">Reference</p>
            <p className="text-sm font-medium">
              {referenceFile?.name || 'Not selected'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-orange-500"></span>
          <div className="flex-1">
            <p className="text-sm text-gray-400">Encoded</p>
            <p className="text-sm font-medium">
              {distortedFile?.name || 'Not selected'}
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={onAnalyze}
        disabled={!canAnalyze}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          canAnalyze
            ? 'bg-blue-600 hover:bg-blue-700 text-white'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
        }`}
      >
        Run VMAF Analysis
      </button>

      {!referenceFile || !distortedFile ? (
        <p className="text-xs text-gray-500 text-center">
          Select a reference and encoded file to start analysis
        </p>
      ) : null}
    </div>
  );
}

export default AnalysisPanel;
