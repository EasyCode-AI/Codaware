// Add a cache object to store file contents
let fileContentCache = {};

// Function to extract file paths from the page content
function extractFilePaths() {
  const filePathRegex = /filepath:([^\s]+)/g;

  const textNodes = document.evaluate(
    "//text()", 
    document.body,
    null,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );

  const paths = new Set();
  
  for (let i = 0; i < textNodes.snapshotLength; i++) {
    const text = textNodes.snapshotItem(i).textContent;
    const matches = text.matchAll(filePathRegex);
    for (const match of matches) {
      paths.add(match[1]);
    }
  }

  return Array.from(paths);
}

function clearFileCache() {
  fileContentCache = {};
}

// Function to populate the cache
async function populateFileCache() {
  const paths = extractFilePaths();
  console.log('Found file paths to cache:', paths);

  for (const path of paths) {
    try {
      if (!fileContentCache[path]) {
        console.log('Fetching content for:', path);
        const content = await getFileContents(path);
        fileContentCache[path] = content;
      }
    } catch (error) {
      console.error(`Failed to cache content for ${path}:`, error);
    }
  }
}

// Modified getFileContents with retry logic
async function getFileContents(filePath, retryCount = 3) {
  filePath = filePath.trim();
  
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        console.log(`Attempt ${attempt}: Sending request for file:`, filePath);
        
        const timeout = setTimeout(() => {
          reject(new Error(`Timeout requesting file: ${filePath}`));
        }, 10000);

        chrome.runtime.sendMessage(
          { type: 'GET_FILE_CONTENTS', filePath },
          response => {
            clearTimeout(timeout);
            
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
              return;
            }

            if (!response) {
              reject(new Error('No response received'));
              return;
            }

            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response.content);
            }
          }
        );
      });
    } catch (error) {
      if (attempt === retryCount) {
        throw error;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

function getSuggestions(query, retryCount = 3, delay = 1000) {
  return new Promise((resolve, reject) => {
    const tryGetSuggestions = (attemptNumber) => {
      if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
        if (attemptNumber < retryCount) {
          console.log(`Chrome storage not available, retrying in ${delay}ms (attempt ${attemptNumber + 1}/${retryCount})`);
          setTimeout(() => tryGetSuggestions(attemptNumber + 1), delay);
          return;
        }
        reject(new Error('Chrome storage API not available'));
        return;
      }

      try {
        chrome.storage.local.get(['filePaths'], (result) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          const files = result.filePaths || [];
        
          const suggestions = files.map(file => ({
            label: file,
            type: file.endsWith('/') ? 'folder' : 'file'
          }));

          /*
          // add special entries such as "problems"
          const suggestions = [
            { label: 'problems', type: 'special' },
            ...files.map(file => ({
              label: '/' + file,
              type: file.endsWith('/') ? 'folder' : 'file'
            }))
          ];
          */

          if (!query) {
            resolve(suggestions);
            return;
          }

          const lowerQuery = query.toLowerCase();
          resolve(suggestions.filter(item => 
            item.label.toLowerCase().includes(lowerQuery)
          ));
        });
      } catch (error) {
        reject(error);
      }
    };

    tryGetSuggestions(0);
  });
}

// Add URL tracking variable
let currentPath = window.location.pathname;

// Modified initializeCache function
function initializeCache() {
  // Function to check if DOM is ready for processing
  function isDOMReady() {
    return document.readyState === 'complete' && 
           document.body !== null && 
           document.documentElement !== null;
  }

  // Function to wait for DOM to be ready
  function waitForDOM(callback, maxAttempts = 3) {
    let attempts = 0;
    
    function checkDOM() {
      attempts++;
      if (isDOMReady()) {
        console.log('DOM is ready, proceeding with cache population');
        callback();
      } else if (attempts < maxAttempts) {
        console.log(`DOM not ready, attempt ${attempts}/${maxAttempts}. Retrying...`);
        setTimeout(checkDOM, 500);
      } else {
        console.warn('Max attempts reached waiting for DOM. Proceeding anyway...');
        callback();
      }
    }

    checkDOM();
  }

  // Setup route observer only when DOM is ready
  function setupRouteObserver() {
    waitForDOM(() => {
      const observer = new MutationObserver((mutations) => {
        const newPath = window.location.pathname;
        if (newPath !== currentPath) {
          console.log('SPA route changed, updating cache...', newPath);
          currentPath = newPath;
          clearFileCache();
          setTimeout(() => {
            console.log('inside page change');
            populateFileCache();
          }, 2000);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      console.log('Route observer set up successfully');
    });
  }

  // Handle navigation events
  window.addEventListener('popstate', () => {
    const newPath = window.location.pathname;
    if (newPath !== currentPath) {
      console.log('Navigation occurred, updating cache...', newPath);
      currentPath = newPath;
      clearFileCache();
      setTimeout(() => {
        console.log('inside page refresh');
        populateFileCache();
      }, 2000);    }
  });

  // Initial cache population
  waitForDOM(() => {
    console.log('Starting initial cache population');
    setTimeout(() => {
      console.log('inside initial cache population');
      populateFileCache();
    }, 2000);
    
  });

  // Set up route observer
  setupRouteObserver();
}

// Call initialization
initializeCache();

function predictApplyDestination(code, filesList) {
    if (!code) {
      return "ERROR: NO CODE PROVIDED";
    }
    if (!filesList) {
      filesList = fileContentCache;
    }
    if (Object.keys(filesList).length === 0) {
      return "ERROR: NO FILES AVAILABLE FOR MATCHING";
    }
  
    try {
      // Use findBestMatch to predict the destination
      const bestMatch = findBestMatch(code, filesList);
      console.log('Best matching file:', bestMatch);
      return bestMatch;
    } catch (error) {
      console.low('Error in predictApplyDestination:', error);
      throw new Error("ERROR: MATCHING FAILED");
    }
  
    //return `client/src/shared/utils/toast.js`;
  }
