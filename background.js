// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  // 简历分析父菜单
  chrome.contextMenus.create({
    id: "resume-analysis",
    title: "简历分析",
    contexts: ["all"],
    documentUrlPatterns: ["*://www.zhipin.com/*"]
  });

  // 粘贴到GPM网站的菜单
  chrome.contextMenus.create({
    id: "paste-to-gpm",
    title: "粘贴简历信息",
    contexts: ["editable"],
    documentUrlPatterns: ["*://gpm.chinafastprint.com/*"]
  });

  // 初始化默认配置
  initDefaultConfig();
});

// 监听存储变化，动态更新菜单
chrome.storage.onChanged.addListener((changes) => {
  if (changes.projects) {
    updateContextMenu();
  }
});

async function initDefaultConfig() {
  const result = await chrome.storage.sync.get(['projects', 'apiConfig']);
  
  if (!result.projects) {
    await chrome.storage.sync.set({
      projects: [
        { 
          id: 'communication', 
          name: '沟通执行力', 
          prompt: '重点评估候选人的沟通能力和执行力',
          fileNameFormat: '{name}-沟通能力评估-{YYYYMMDD}.html',
          downloadPrompt: '请将以下简历内容格式化为纯文本，移除所有个人联系方式（电话、邮箱）。'
        },
        { 
          id: 'data', 
          name: '数据分析', 
          prompt: '重点评估候选人的数据分析和Excel技能',
          fileNameFormat: '{name}-数据分析评估-{YYYYMMDD}.html',
          downloadPrompt: '请将以下简历内容格式化为纯文本，并移除教育背景部分。'
        }
      ]
    });
  }
  
  if (!result.apiConfig) {
    await chrome.storage.sync.set({
      apiConfig: {
		endpoint: '',
        model: '',
        apiKey: ''
      }
    });
  }
  
  updateContextMenu();
}

async function updateContextMenu() {
    // 使用新的API，先移除所有由该插件创建的菜单
    await chrome.contextMenus.removeAll();

    // 重新创建所有菜单
    chrome.contextMenus.create({
        id: "resume-analysis",
        title: "简历分析",
        contexts: ["all"],
        documentUrlPatterns: ["*://www.zhipin.com/*"]
    });

    chrome.contextMenus.create({
        id: "paste-to-gpm",
        title: "粘贴简历信息",
        contexts: ["editable"],
        documentUrlPatterns: ["*://gpm.chinafastprint.com/*"]
    });

    // 从存储获取项目配置来创建子菜单
    const { projects } = await chrome.storage.sync.get(['projects']);
    if (projects && projects.length > 0) {
        projects.forEach((project) => {
            chrome.contextMenus.create({
                id: `analyze-${project.id}`,
                parentId: "resume-analysis",
                title: project.name,
                contexts: ["all"]
            });
        });
    }
}

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId.startsWith('analyze-')) {
    const projectId = info.menuItemId.replace('analyze-', '');
    chrome.tabs.sendMessage(tab.id, {
      action: 'analyzeResume',
      projectId: projectId
    });
  } else if (info.menuItemId === 'paste-to-gpm') {
    const result = await chrome.storage.local.get(['latestCandidateInfo']);
    if (result.latestCandidateInfo) {
      chrome.tabs.sendMessage(tab.id, {
        action: 'fillForm',
        data: result.latestCandidateInfo
      });
    } else {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => { alert('没有找到可粘贴的简历信息，请先在Boss直聘上分析一份简历。'); }
      });
    }
  }
});

// 【新增】监听来自content script的下载请求
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'downloadFile') {
        chrome.downloads.download({
            url: request.url,
            filename: request.filename,
            saveAs: true // 允许用户选择保存位置
        }).then(downloadId => {
            console.log(`开始下载，ID: ${downloadId}`);
            sendResponse({success: true});
        }).catch(error => {
            console.error(`下载失败: ${error}`);
            sendResponse({success: false, error: error.message});
        });
        return true; // 保持消息通道开启以进行异步响应
    }
});