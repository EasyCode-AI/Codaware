// Save options to chrome.storage
function saveOptions() {
    const port = document.getElementById('port').value;
    chrome.storage.local.set({
        websocketPort: parseInt(port) || 49201
    }, () => {
        // Update status to let user know options were saved
        const status = document.getElementById('status');
        status.textContent = 'Options saved.';
        setTimeout(() => {
            status.textContent = '';
        }, 2000);
    });
}

// Clear file paths cache
function clearFilesCache() {
    const status = document.getElementById('status');
    chrome.storage.local.remove('filePaths', () => {
        status.textContent = 'Files cache cleared.';
        
        chrome.runtime.sendMessage({ type: 'REQUEST_FILES' }, response => {
            if (response && response.success) {
                status.textContent = 'Files cache updated.';
                displayCachedFiles();
            } else {
                status.textContent = 'Failed to update files cache.';
            }
        });
    });
}

async function isWebSocketConnected() {
    // Send a message to background script to check connection status
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'CHECK_CONNECTION' }, response => {
        resolve(response?.connected || false);
      });
    });
  }

// Check WebSocket connection status
function checkConnection() {
    try {
        const status = document.getElementById('status');

        isWebSocketConnected().then(connected => {
        
            if (connected) {
                status.textContent = 'Connected to VS Code.';
                status.style.color = '#4CAF50';
            } else {
                status.textContent = 'Not connected to VS Code. Make sure EasyCode extension is running in VS Code.';
                status.style.color = '#F44336';
            }
            
        });

        
    } catch (error) {
        console.error('Error checking connection:', error);
        const status = document.getElementById('status');
        status.textContent = 'Error checking connection.';
        status.style.color = '#F44336';
    }
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restoreOptions() {
    chrome.storage.local.get({
        websocketPort: 49201 // default value
    }, (items) => {
        document.getElementById('port').value = items.websocketPort;
    });
}

// Add this function to display cached files
function displayCachedFiles() {
    const cachedFilesElement = document.getElementById('cachedFiled');
    
    chrome.storage.local.get('filePaths', (result) => {
        const files = result.filePaths || [];
        
        if (files.length === 0) {
            cachedFilesElement.innerHTML = '<p>No cached files found. Please make sure EasyCode extension is running in VS Code</p>';
            return;
        }

        const fileList = document.createElement('ul');
        fileList.style.cssText = 'list-style: none; padding: 0; max-height: 300px; overflow-y: auto;';
        
        files.forEach(file => {
            const li = document.createElement('li');
            li.textContent = file;
            li.style.cssText = 'padding: 4px 0; border-bottom: 1px solid #eee;';
            fileList.appendChild(li);
        });

        cachedFilesElement.innerHTML = ''; // Clear previous content
        cachedFilesElement.appendChild(fileList);
        
        // Add file count
        const countDiv = document.createElement('div');
        countDiv.textContent = `Total files: ${files.length}`;
        countDiv.style.marginTop = '10px';
        cachedFilesElement.appendChild(countDiv);
    });
}

document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);
document.getElementById('clearCache').addEventListener('click', clearFilesCache);
document.getElementById('checkConnection').addEventListener('click', checkConnection);

// Existing options code for port settings...

const commonIgnoredPatterns = [
    // Update patterns to match paths more accurately
    /[\/\\]node_modules[\/\\]/,  // This will match node_modules anywhere in the path
    /[\/\\]\.git[\/\\]/,
    /[\/\\]\.DS_Store$/,
    /[\/\\]\.env$/,
    /[\/\\]\.vscode[\/\\]/,
    /[\/\\]\.idea[\/\\]/,
    /[\/\\]dist[\/\\]/,
    /[\/\\]build[\/\\]/,
    /\.png$/,
    /\.jpg$/,
    /\.jpeg$/,
    /\.ico$/,
    /\.log$/,
    /\.lock$/,
    /package-lock\.json$/,
    /yarn\.lock$/
];

async function updateProgress(fileListElement, message) {
    const progressDiv = fileListElement.querySelector('.progress') || (() => {
        const div = document.createElement('div');
        div.className = 'progress';
        fileListElement.appendChild(div);
        return div;
    })();
    progressDiv.textContent = message;
}

// Function to parse ignore file contents into patterns
async function parseIgnoreFile(fileHandle) {
    try {
        const file = await fileHandle.getFile();
        const contents = await file.text();
        
        return contents
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'))
            .map(pattern => {
                // Convert glob patterns to RegExp
                pattern = pattern
                    .replace(/\./g, '\\.')
                    .replace(/\*/g, '.*')
                    .replace(/\?/g, '.');
                return new RegExp(pattern);
            });
    } catch (error) {
        console.warn('Error reading ignore file:', error);
        return [];
    }
}

// Improved shouldIgnorePath function
function shouldIgnorePath(path, ignorePatterns) {
    // Normalize path separators
    const normalizedPath = path.replace(/\\/g, '/');
    return ignorePatterns.some(pattern => pattern.test(normalizedPath));
}

// Modified listFilesRecursively function
async function* listFilesRecursively(dirHandle, path = '', fileListElement, ignorePatterns = null) {
    try {
        // Load ignore patterns if we're at the root and haven't loaded them yet
        if (!ignorePatterns) {
            ignorePatterns = [...commonIgnoredPatterns];
            
            try {
                // Try to read .gitignore
                const gitignoreHandle = await dirHandle.getFileHandle('.gitignore');
                const gitignorePatterns = await parseIgnoreFile(gitignoreHandle);
                ignorePatterns.push(...gitignorePatterns);
            } catch (error) {
                // .gitignore doesn't exist, ignore error
            }

            try {
                // Try to read easycode.ignore
                const easycodeIgnoreHandle = await dirHandle.getFileHandle('easycode.ignore');
                const easycodeIgnorePatterns = await parseIgnoreFile(easycodeIgnoreHandle);
                ignorePatterns.push(...easycodeIgnorePatterns);
            } catch (error) {
                // easycode.ignore doesn't exist, ignore error
            }
        }

        for await (const entry of dirHandle.values()) {
            const relativePath = path ? `${path}/${entry.name}` : entry.name;
            
            await updateProgress(fileListElement, `Scanning: ${relativePath}`);
            
            // Check if path should be ignored
            if (shouldIgnorePath(relativePath, ignorePatterns)) {
                continue;
            }

            if (entry.kind === 'directory') {
                try {
                    const newDirHandle = await dirHandle.getDirectoryHandle(entry.name);
                    yield* listFilesRecursively(newDirHandle, relativePath, fileListElement, ignorePatterns);
                } catch (error) {
                    console.warn(`Skipping directory ${relativePath}:`, error);
                }
            } else {
                yield relativePath;
            }
        }
    } catch (error) {
        console.error(`Error processing directory ${path}:`, error);
        throw error; // Rethrow to handle it in the calling function
    }
}

async function handleFolderSelection() {
    const fileListElement = document.getElementById('fileList');
    fileListElement.innerHTML = '<h3>Files in project:</h3>';
    
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.style.display = 'none';

    input.addEventListener('change', async (e) => {
        // FileList object contains file metadata without reading contents
        const files = Array.from(e.target.files);
        const fileList = document.createElement('ul');
        fileList.style.cssText = 'list-style: none; padding: 0; max-height: 400px; overflow-y: auto;';
        fileListElement.appendChild(fileList);

        let fileCount = 0;
        
        // Each file object has these properties without reading content:
        // - name: filename
        // - webkitRelativePath: full path relative to selected directory
        // - size: file size in bytes
        // - type: MIME type
        // - lastModified: timestamp

        for (const file of files) {
          // Check if file should be ignored
          if (shouldIgnorePath(file.webkitRelativePath, commonIgnoredPatterns)) {
              console.log("ignoring ", file.webkitRelativePath);
              continue;
          }

          const li = document.createElement('li');
          li.textContent = file.webkitRelativePath;
          li.style.cssText = 'padding: 4px 0; border-bottom: 1px solid #eee;';

          fileCount++;
          fileList.append(li);
      }

          // Show final count
          const countDiv = document.createElement('div');
          countDiv.textContent = `Total files: ${fileCount}`;
          countDiv.style.marginTop = '10px';
          fileListElement.appendChild(countDiv);
      

        const fileMetadata = files.map(file => ({
            name: file.name,
            path: file.webkitRelativePath,
            size: file.size,
            type: file.type,
            lastModified: new Date(file.lastModified)
        })).filter(file => !shouldIgnorePath(file.path, commonIgnoredPatterns));

        // Store metadata for later use
        chrome.storage.local.set({ 
            projectPath: files[0]?.webkitRelativePath.split('/')[0] || '',
            projectLastAccessed: Date.now(),
            fileMetadata: fileMetadata // Store metadata for later use
        });

        // Display files using virtual scrolling...
        // (rest of the display logic from previous optimized version)
    });

    input.click();
}

// Later, when you need to read a specific file's content:
async function readFileContent(filePath) {
    const input = document.createElement('input');
    input.type = 'file';
    input.setAttribute('webkitdirectory', '');
    
    return new Promise((resolve, reject) => {
        input.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            const targetFile = files.find(f => f.webkitRelativePath === filePath);
            
            if (!targetFile) {
                reject(new Error('File not found'));
                return;
            }

            try {
                const content = await targetFile.text();
                resolve(content);
            } catch (error) {
                reject(error);
            }
        });
        
        input.click();
    });
}

// Add event listener for folder selection
document.getElementById('selectFolder').addEventListener('click', handleFolderSelection);

// Initialize UI when document loads
document.addEventListener('DOMContentLoaded', () => {
    const selectFolderBtn = document.getElementById('selectFolder');
    selectFolderBtn.style.cssText = `
        margin-top: 20px;
        background-color: #2196F3;
        color: white;
        padding: 8px 15px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;
    
    selectFolderBtn.addEventListener('mouseover', () => {
        selectFolderBtn.style.backgroundColor = '#1976D2';
    });
    selectFolderBtn.addEventListener('mouseout', () => {
        selectFolderBtn.style.backgroundColor = '#2196F3';
    });

    restoreOptions();
    checkConnection();
    displayCachedFiles(); // Display cached files when page loads
});

// Add storage change listener to update displayed files when cache changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.filePaths) {
        displayCachedFiles();
    }
});
