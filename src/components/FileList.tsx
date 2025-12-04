import { useState } from 'react';

interface UploadedFile {
  type: 'file';
  key: string;
  name: string;
  size: number;
}

interface Folder {
  type: 'folder';
  key: string;
  name: string;
}

interface FileListProps {
  files: UploadedFile[];
  folders: Folder[];
  currentFolder: string;
  currentBucket: string;
  selectedReference: string | null;
  selectedDistorted: string | null;
  onSelectReference: (key: string | null) => void;
  onSelectDistorted: (key: string | null) => void;
  onNavigateToFolder: (folder: string) => void;
  onCreateFolder: () => void;
  onDeleteFile: (key: string) => void;
  onDeleteFolder: (key: string) => void;
}

// Supported video file extensions
const SUPPORTED_VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.ts'];

const isVideoFile = (filename: string): boolean => {
  const lowerName = filename.toLowerCase();
  return SUPPORTED_VIDEO_EXTENSIONS.some(ext => lowerName.endsWith(ext));
};

function FileList({
  files,
  folders,
  currentFolder,
  currentBucket,
  selectedReference,
  selectedDistorted,
  onSelectReference,
  onSelectDistorted,
  onNavigateToFolder,
  onCreateFolder,
  onDeleteFile,
  onDeleteFolder,
}: FileListProps) {
  const [deletingItem, setDeletingItem] = useState<string | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const handleDelete = async (item: UploadedFile | Folder) => {
    if (!confirm(`Are you sure you want to delete "${item.name}"?`)) {
      return;
    }

    setDeletingItem(item.key);
    try {
      if (item.type === 'folder') {
        await onDeleteFolder(item.key);
      } else {
        await onDeleteFile(item.key);
      }
    } finally {
      setDeletingItem(null);
    }
  };

  const navigateUp = () => {
    const parts = currentFolder.split('/');
    parts.pop();
    onNavigateToFolder(parts.join('/'));
  };

  return (
    <div className="space-y-3">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => onNavigateToFolder('')}
          className="text-blue-400 hover:text-blue-300"
        >
          {currentBucket || 'Root'}
        </button>
        {currentFolder.split('/').filter(Boolean).map((part, index, arr) => (
          <div key={index} className="flex items-center gap-2">
            <span className="text-gray-500">/</span>
            <button
              onClick={() => onNavigateToFolder(arr.slice(0, index + 1).join('/'))}
              className={index === arr.length - 1 ? 'text-gray-300' : 'text-blue-400 hover:text-blue-300'}
            >
              {part}
            </button>
          </div>
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex gap-2">
        {currentFolder && (
          <button
            onClick={navigateUp}
            className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            ← Back
          </button>
        )}
        <button
          onClick={onCreateFolder}
          className="px-3 py-1.5 text-sm border border-dashed border-gray-500 text-gray-400 hover:bg-gray-700 hover:border-gray-400 hover:text-gray-300 rounded-lg transition-colors"
        >
          + New Folder
        </button>
      </div>

      {/* Folders */}
      {folders.map((folder) => (
        <div
          key={folder.key}
          className="p-3 rounded-lg border border-gray-700 bg-gray-700/50 hover:bg-gray-700 transition-colors"
        >
          <div className="flex items-center justify-between">
            <button
              onClick={() => onNavigateToFolder(folder.key.replace(/\/$/, ''))}
              className="flex-1 flex items-center gap-2 min-w-0 text-left"
            >
              <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              <span className="text-sm font-medium truncate">{folder.name}</span>
            </button>
            <button
              onClick={() => handleDelete(folder)}
              disabled={deletingItem === folder.key}
              className="ml-2 p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
              title="Delete folder"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      ))}

      {/* Files */}
      {files.length === 0 && folders.length === 0 && (
        <p className="text-gray-500 text-center py-4">
          No files or folders
        </p>
      )}

      {files.map((file) => {
        const isVideo = isVideoFile(file.name);
        return (
          <div
            key={file.key}
            className={`p-3 rounded-lg border ${
              selectedReference === file.key
                ? 'border-green-500 bg-green-500/10'
                : selectedDistorted === file.key
                ? 'border-orange-500 bg-orange-500/10'
                : 'border-gray-700 bg-gray-700/50'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
              </div>
              <div className="flex gap-2 ml-4">
                {isVideo && (
                  <>
                    <button
                      onClick={() =>
                        onSelectReference(
                          selectedReference === file.key ? null : file.key
                        )
                      }
                      className={`px-2 py-1 text-xs rounded ${
                        selectedReference === file.key
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`}
                      title="Select as reference"
                    >
                      Ref
                    </button>
                    <button
                      onClick={() =>
                        onSelectDistorted(
                          selectedDistorted === file.key ? null : file.key
                        )
                      }
                      className={`px-2 py-1 text-xs rounded ${
                        selectedDistorted === file.key
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                      }`}
                      title="Select as distorted/encoded"
                    >
                      Enc
                    </button>
                  </>
                )}
                <button
                  onClick={() => handleDelete(file)}
                  disabled={deletingItem === file.key}
                  className="p-1 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                  title="Delete file"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default FileList;
