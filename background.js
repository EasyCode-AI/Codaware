import mixpanel from "./mixpanel.js"

mixpanel.init("885bb3993bb98e37dbb21823f8d1903d");

chrome.runtime.onInstalled.addListener((details) => {
	// tracking extension install
  console.log("extension installed");
  mixpanel.track('Install');
})

let websocketPort; // default port

// Initialize port when extension loads
initializePort();

function initializePort() {
  chrome.storage.local.get({ websocketPort: 49201 }, (items) => {
    websocketPort = items.websocketPort;
    connectWebSocket();
  });
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second between retries

// Listen for changes to the port setting
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.websocketPort) {
      websocketPort = changes.websocketPort.newValue;
      // Reconnect with new port if socket exists
      if (socket) {
          socket.close();
          connectWebSocket();
      }
  }
});

function safeStorageAccess(operation) {
  // Check if chrome.storage is available
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return operation();
  } else {
    console.warn('Chrome storage API not available');
    // Optionally retry after a short delay
    setTimeout(() => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        operation();
      }
    }, 1000);
  }
}

// Helper function to safely send WebSocket messages
function safeSendWebSocketMessage(message) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
    return true;
  }
  console.warn('WebSocket not ready, message not sent:', message);
  return false;
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('ChatGPT Mention Extension installed.');
});

let socket;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY = 3000; // 3 seconds

function connectWebSocket(retry = false) {
  try{
    socket = new WebSocket(`ws://localhost:${websocketPort}`);
  } catch (e) {
    console.warn("Failed to establish websocket connect");
  }
  
  socket.onopen = () => {
    console.log('Connected to VS Code extension');
    reconnectAttempts = 0; // Reset attempts on successful connection
    
    // Add a small delay to ensure the connection is ready
    setTimeout(() => {
      safeSendWebSocketMessage({
          type: 'REQUEST_FILES'
      });
    }, 100);
  };
  
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'FILE_LIST') {
      console.log(`received file list`);
      safeStorageAccess(() => {
        chrome.storage.local.set({
          filePaths: data.files
        });
      });
    } else if (data.type === 'FILE_CONTENTS') {
      console.log("Looking for file content callback for:", data.filePath);
      if (fileContentCallbacks[data.filePath]) {
        // Ensure content is properly decoded
        const content = typeof data.content === 'string' 
          ? data.content 
          : new TextDecoder('utf-8').decode(data.content);
          
        fileContentCallbacks[data.filePath]({
          content: content
        });
        delete fileContentCallbacks[data.filePath];
      } else {
        console.warn("No file content callback found for:", data.filePath);
      }
    } else if (data.type === 'DIFF_CLIPBOARD_RESULT') { // Assuming this is the type for diff responses
      console.log("Looking for diff callback for:", data.fileName);
      if (diffCallbacks[data.fileName]) {
        diffCallbacks[data.fileName](data);
        delete diffCallbacks[data.fileName];
      } else {
        console.warn("No diff callback found for:", data.fileName);
      }
    }
  };
  
  socket.onerror = (error) => {
    console.warn('WebSocket error:', error);
  };
  
  socket.onclose = () => {
    if (!retry) {
      console.log('WebSocket closed');
      return;
    } else {
      // Attempt to reconnect
      if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        console.log(`Attempting to reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(connectWebSocket, RECONNECT_DELAY);
      } else {
        console.warn('Max reconnection attempts reached');
      }
    }
  };
}

// Add a function to check connection status
async function isSocketConnected() {
  let isConnected = socket && socket.readyState === WebSocket.OPEN;
  if (!isConnected) {
    console.log('Socket not connected. Attempting to reconnect...');
    reconnectAttempts = 0;
    
    // Create a promise that resolves when connection is established or rejects after timeout
    const connectionPromise = new Promise((resolve, reject) => {
      const originalOnOpen = socket?.onopen;
      const originalOnError = socket?.onerror;
      
      // Set a timeout to reject the promise if connection takes too long
      const timeoutId = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 1000); // 5 second timeout
      
      connectWebSocket();
      
      socket.onopen = (event) => {
        clearTimeout(timeoutId);
        if (originalOnOpen) originalOnOpen(event);
        else {
          setTimeout(() => {
            safeSendWebSocketMessage({
                type: 'REQUEST_FILES'
            });
          }, 100);
        }
        resolve();
      };
      
      socket.onerror = (error) => {
        clearTimeout(timeoutId);
        if (originalOnError) originalOnError(error);
        reject(error);
      };
    });

    try {
      await connectionPromise;
      isConnected = socket && socket.readyState === WebSocket.OPEN;
    } catch (error) {
      console.warn('Failed to establish connection:', error);
      isConnected = false;
    }
  }
  return isConnected;
}

// Separate callback queues
let fileContentCallbacks = {};
let diffCallbacks = {};

// Add a helper function to handle retries
async function retryOperation(operation, maxRetries = MAX_RETRIES) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const isConnected = await isSocketConnected();
    if (isConnected) {
      return await operation();
    }
    
    console.log(`WebSocket not connected, attempt ${attempt + 1}/${maxRetries}`);
    
    // Try to reconnect
    connectWebSocket();
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
  }
  
  throw new Error('WebSocket connection failed after retries');
}

// Modify the message listener to use retries
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'APPLY_DIFF') {
    console.log("Background: received request to apply diff for:", message.fileName);
    
    retryOperation(async () => {
      // Store in diff-specific callback queue
      diffCallbacks[message.fileName] = (response) => {
        console.log("Diff result received:", response);
        sendResponse(response);
      };
      
      if (!safeSendWebSocketMessage({
        type: 'DIFF_CLIPBOARD',
        fileName: message.fileName,
        code: `${message.code}\n`
      })) {
        throw new Error('Failed to send diff request');
      }
    })
    .catch(error => {
      console.log('Error applying diff:', error);
      sendResponse({ 
        error: 'Failed to apply changes after retries. Please check your connection.' 
      });
    });

    return true;
  }
  else if (message.type === 'GET_FILE_CONTENTS') {
    console.log("Background: received request for file:", message.filePath);
    
    retryOperation(async () => {
      // Store in file-specific callback queue  
      fileContentCallbacks[message.filePath] = (response) => {
        console.log("Executing callback for:", message.filePath, response);
        sendResponse(response);
      };

      if (!safeSendWebSocketMessage({
        type: 'GET_FILE_CONTENTS',
        filePath: message.filePath.trim()
      })) {
        throw new Error('Failed to send file contents request');
      }
    })
    .catch(error => {
      console.warn('Error getting file contents:', error);
      sendResponse({ 
        error: 'Failed to get file contents after retries. Please check your connection.' 
      });
    });

    return true;
  }
  else if (message.type === 'CHECK_CONNECTION') {
    isSocketConnected().then(connected => {
      sendResponse({ connected });
    });
    return true;
  } else if (message.type === "REQUEST_FILES") {
    // Create a promise that resolves when files are updated
    const filesUpdatePromise = new Promise((resolve) => {
      // Store the resolve function in a callback that will be called 
      // when we receive the FILE_LIST response
      const messageCallback = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'FILE_LIST') {
          socket.removeEventListener('message', messageCallback);
          resolve(data.files);
        }
      };
      
      // Add temporary listener for this specific request
      socket.addEventListener('message', messageCallback);
      
      // Send the request
      safeSendWebSocketMessage({
        type: 'REQUEST_FILES'
      });
      
      // Add timeout to prevent hanging
      setTimeout(() => {
        socket.removeEventListener('message', messageCallback);
        resolve([]); // Resolve with empty array if timeout
      }, 5000);
    });

    // Wait for files to be updated before sending response
    filesUpdatePromise.then((files) => {
      sendResponse({ success: true, files });
    });

    return true; // Keep message channel open for async response
  }
});
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openOptions') {
    chrome.runtime.openOptionsPage();
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  await handleTabUrl(tab.url);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    await handleTabUrl(changeInfo.url);
  }
});

async function handleTabUrl(url) {
  const validUrls = [
    'https://chat.openai.com',
    'https://chatgpt.com',
    'https://claude.ai'
  ];

  const shouldConnect = validUrls.some(validUrl => url?.startsWith(validUrl));

  if (shouldConnect) {
    const isConnected = await isSocketConnected();
    if (!isConnected) {
      chrome.storage.local.get({
        websocketPort
      }, (items) => {
        websocketPort = items.websocketPort;
        connectWebSocket();
      });
    }
  } else {
    // Disconnect if we're on a non-matching page
    if (socket) {
      socket.close();
      socket = null;
    }
  }
}

async function checkExistingTabs() {
  const tabs = await chrome.tabs.query({active: true});
  if (tabs[0]) {
    handleTabUrl(tabs[0].url);
  }
}

chrome.runtime.onInstalled.addListener(() => {
  checkExistingTabs();
});