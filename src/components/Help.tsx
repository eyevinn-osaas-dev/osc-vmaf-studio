import { useState } from 'react';

interface HelpProps {
  isOpen: boolean;
  onClose: () => void;
}

function Help({ isOpen, onClose }: HelpProps) {
  const [activeSection, setActiveSection] = useState<string>('getting-started');

  if (!isOpen) return null;

  const sections = {
    'getting-started': {
      title: 'Getting Started',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-200">Welcome to OSC VMAF Studio!</h3>
          <p className="text-gray-300">
            OSC VMAF Studio is a web-based tool for assessing video quality using VMAF (Video Multimethod Assessment Fusion).
          </p>
          <div className="bg-gray-700 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-200 mb-2">Quick Start</h4>
            <ol className="list-decimal list-inside space-y-2 text-gray-300">
              <li>Configure your S3 and OSaaS settings (click the settings icon ⚙️)</li>
              <li>Select or create a bucket to store your videos</li>
              <li>Upload your reference and distorted video files</li>
              <li>Select both videos and create a VMAF analysis job</li>
              <li>View results when the analysis completes</li>
            </ol>
          </div>
        </div>
      ),
    },
    'configuration': {
      title: 'Configuration',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-200">Configuring VMAF Analyzer</h3>

          <div className="bg-gray-700 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-200 mb-2">S3 Configuration</h4>
            <p className="text-gray-300 text-sm mb-3">Choose your storage type:</p>

            <div className="mb-3 pl-3 border-l-2 border-blue-500">
              <p className="text-gray-200 font-medium mb-1">AWS S3</p>
              <ul className="space-y-1 text-gray-300 text-sm">
                <li><strong>S3 Bucket:</strong> S3 bucket name (e.g., my-bucket-name)</li>
                <li><strong>Region:</strong> AWS region (e.g., us-east-1, eu-west-1)</li>
                <li><strong>Access Key:</strong> AWS access key ID</li>
                <li><strong>Secret Key:</strong> AWS secret access key</li>
              </ul>
            </div>

            <div className="pl-3 border-l-2 border-purple-500">
              <p className="text-gray-200 font-medium mb-1">S3-Compatible (MinIO, OCI, etc.)</p>
              <ul className="space-y-1 text-gray-300 text-sm">
                <li><strong>Endpoint:</strong> Full endpoint URL (e.g., https://your-minio.osaas.io)</li>
                <li><strong>Access Key:</strong> S3 access key ID</li>
                <li><strong>Secret Key:</strong> S3 secret access key</li>
              </ul>
            </div>
          </div>

          <div className="bg-gray-700 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-200 mb-2">Eyevinn OSaaS Configuration</h4>
            <ul className="space-y-2 text-gray-300">
              <li><strong>Personal Access Token:</strong> Your OSaaS API token for authentication</li>
            </ul>
            <p className="text-gray-400 text-sm mt-3">
              Don't have an OSaaS account? Visit <a href="https://www.osaas.io/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">osaas.io</a> to learn more.
            </p>
          </div>

          <div className="bg-blue-900/30 border border-blue-700 p-3 rounded-lg">
            <p className="text-blue-200 text-sm">
              <strong>Security Note:</strong> All credentials are stored securely on the backend server only and never sent to your browser.
            </p>
          </div>
        </div>
      ),
    },
    'buckets': {
      title: 'Managing Buckets',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-200">Bucket Management</h3>
          <p className="text-gray-300">
            Buckets help you organize your videos and analysis results across different projects or clients.
          </p>

          <div className="space-y-3">
            <div className="bg-gray-700 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-200 mb-1">Selecting a Bucket</h4>
              <p className="text-gray-300 text-sm">
                Use the bucket dropdown in the header to switch between buckets. Files and jobs are displayed for the currently selected bucket.
              </p>
            </div>

            <div className="bg-gray-700 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-200 mb-1">Creating a Bucket</h4>
              <p className="text-gray-300 text-sm">
                Click the "+" button next to the bucket selector to create a new bucket. Bucket names must be unique and follow S3 naming conventions.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    'files': {
      title: 'File Management',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-200">Working with Files</h3>

          <div className="space-y-3">
            <div className="bg-gray-700 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-200 mb-1">Uploading Files (not for AWS S3)</h4>
              <ol className="list-decimal list-inside space-y-1 text-gray-300 text-sm">
                <li>Navigate to the desired bucket and folder</li>
                <li>Click the "Upload Files" button</li>
                <li>Select one or more video files</li>
                <li>Files are uploaded directly to S3</li>
              </ol>
            </div>

            <div className="bg-gray-700 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-200 mb-1">Organizing Files</h4>
              <p className="text-gray-300 text-sm">
                Create folders to organize your videos. Click into folders to navigate, and use the breadcrumb trail to go back.
              </p>
            </div>

            <div className="bg-gray-700 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-200 mb-1">Deleting Files</h4>
              <p className="text-gray-300 text-sm">
                Click the trash icon on any file or folder to delete it. Deleting a folder removes all contents recursively.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    'vmaf-analysis': {
      title: 'VMAF Analysis',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-200">Running VMAF Analysis</h3>

          <div className="bg-gray-700 p-4 rounded-lg">
            <h4 className="font-semibold text-gray-200 mb-2">What is VMAF?</h4>
            <p className="text-gray-300 text-sm">
              VMAF (Video Multimethod Assessment Fusion) is a perceptual video quality assessment algorithm developed by Netflix.
              It predicts subjective video quality based on a reference and distorted video pair.
            </p>
          </div>

          <div className="space-y-3">
            <div className="bg-gray-700 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-200 mb-1">Creating an Analysis Job</h4>
              <ol className="list-decimal list-inside space-y-1 text-gray-300 text-sm">
                <li>Click "Create VMAF Job"</li>
                <li>Select your <strong>reference video</strong> (original, high-quality source)</li>
                <li>Select your <strong>distorted video</strong> (encoded/compressed version)</li>
                <li>Add an optional description</li>
                <li>Click "Start Analysis"</li>
              </ol>
            </div>

            <div className="bg-gray-700 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-200 mb-1">Job Status</h4>
              <ul className="space-y-1 text-gray-300 text-sm">
                <li><span className="text-yellow-400">●</span> <strong>Queued:</strong> Job waiting to start</li>
                <li><span className="text-blue-400">●</span> <strong>Running:</strong> Analysis in progress</li>
                <li><span className="text-green-400">●</span> <strong>Completed:</strong> Analysis finished successfully</li>
                <li><span className="text-red-400">●</span> <strong>Failed:</strong> Analysis encountered an error</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
    'results': {
      title: 'Viewing Results',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-200">Understanding Results</h3>

          <div className="space-y-3">
            <div className="bg-gray-700 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-200 mb-1">Overall Score</h4>
              <p className="text-gray-300 text-sm">
                The VMAF score ranges from 0-100, where higher scores indicate better quality. A score above 90 is generally considered excellent.
              </p>
            </div>

            <div className="bg-gray-700 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-200 mb-1">Expanding Results</h4>
              <p className="text-gray-300 text-sm">
                Click the expand chevron (▼) on a completed job to view detailed results including:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm mt-2">
                <li>Interactive chart showing per-frame scores</li>
                <li>Metric statistics (mean, min, max, harmonic mean)</li>
                <li>Multiple VMAF metrics (vmaf, vmaf_hd, vmaf_4k, etc.)</li>
                <li>Frame-by-frame score data</li>
              </ul>
            </div>

            <div className="bg-gray-700 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-200 mb-1">Downloading Results</h4>
              <p className="text-gray-300 text-sm">
                Click "Download Raw Results" to save the complete analysis data in JSON format for further processing or archival.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    'troubleshooting': {
      title: 'Troubleshooting',
      content: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-200">Common Issues</h3>

          <div className="space-y-3">
            <div className="bg-gray-700 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-200 mb-1">Configuration Not Working</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
                <li>Verify your OSaaS Personal Access Token is valid</li>
                <li>Ensure S3 endpoint URL includes https:// (for S3-Compatible storage)</li>
                <li>Verify S3 credentials have required permissions</li>
              </ul>
            </div>

            <div className="bg-gray-700 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-200 mb-1">Jobs Not Starting</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
                <li>Check that your OSaaS account has VMAF analysis capabilities</li>
                <li>Ensure both videos are in valid, supported formats</li>
                <li>Verify OSaaS has access to your S3 bucket</li>
              </ul>
            </div>

            <div className="bg-gray-700 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-200 mb-1">Results Not Loading</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
                <li>Jobs must complete successfully before results appear</li>
                <li>Check browser console for errors (press F12)</li>
                <li>Verify the job's bucket still exists</li>
                <li>Try refreshing the page</li>
              </ul>
            </div>

            <div className="bg-gray-700 p-3 rounded-lg">
              <h4 className="font-semibold text-gray-200 mb-1">Files Not Appearing</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-300 text-sm">
                <li>Ensure you're viewing the correct bucket</li>
                <li>Check S3 permissions for listing objects</li>
                <li>Refresh the page to reload the file list</li>
              </ul>
            </div>
          </div>
        </div>
      ),
    },
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">Help & Documentation</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
            title="Close"
          >
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          <div className="w-64 border-r border-gray-700 overflow-y-auto">
            <nav className="p-4 space-y-1">
              {Object.entries(sections).map(([key, section]) => (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                    activeSection === key
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {section.title}
                </button>
              ))}
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {sections[activeSection as keyof typeof sections]?.content}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-750">
          <p className="text-sm text-gray-400 text-center">
            For more information, visit the{' '}
            <a
              href="https://github.com/Netflix/vmaf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              VMAF documentation
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Help;
