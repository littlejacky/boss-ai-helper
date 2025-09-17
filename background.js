// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  // 先创建父菜单
  chrome.contextMenus.create({
    id: "resume-analysis",
    title: "简历分析",
    contexts: ["all"]
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
        { id: 'communication', name: '沟通执行力', prompt: '重点评估候选人的沟通能力和执行力' },
        { id: 'data', name: '数据分析', prompt: '重点评估候选人的数据分析和Excel技能' },
        { id: 'management', name: '团队管理', prompt: '重点评估候选人的管理能力和行业经验' }
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
  // 清除旧菜单项
  chrome.contextMenus.removeAll(() => {
    // 重新创建父菜单
    chrome.contextMenus.create({
      id: "resume-analysis",
      title: "简历分析",
      contexts: ["all"]
    });

    // 从存储获取项目配置
    chrome.storage.sync.get(['projects'], (result) => {
      const projects = result.projects || [];
      
      projects.forEach((project) => {
        chrome.contextMenus.create({
          id: `analyze-${project.id}`,
          parentId: "resume-analysis",
          title: project.name,
          contexts: ["all"]
        });
      });
    });
  });
}

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId.startsWith('analyze-')) {
    const projectId = info.menuItemId.replace('analyze-', '');
    
    chrome.tabs.sendMessage(tab.id, {
      action: 'analyzeResume',
      projectId: projectId
    });
  }
});