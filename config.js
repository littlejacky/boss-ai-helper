// 加载配置
async function loadConfig() {
  const result = await chrome.storage.sync.get(['projects', 'apiConfig']);
  
  const apiConfig = result.apiConfig || {};
  document.getElementById('apiEndpoint').value = apiConfig.endpoint || '';
  document.getElementById('apiModel').value = apiConfig.model || '';
  document.getElementById('apiKey').value = apiConfig.apiKey || '';
  
  const projects = result.projects || [];
  renderProjects(projects);
}

// 渲染项目列表
function renderProjects(projects) {
  const container = document.getElementById('projectList');
  container.innerHTML = '';
  
  projects.forEach((project, index) => {
    const div = document.createElement('div');
    div.className = 'project-item';
    div.innerHTML = `
      <label>项目名称</label>
      <input type="text" value="${project.name || ''}" data-field="name" data-index="${index}" placeholder="例如：Java后端岗">
      <label>分析提示词 (Prompt)</label>
      <textarea data-field="prompt" data-index="${index}" placeholder="例如：重点评估候选人的并发编程能力和微服务经验。" rows="3">${project.prompt || ''}</textarea>
      <label>下载文件名格式</label>
      <input type="text" value="${project.fileNameFormat || ''}" data-field="fileNameFormat" data-index="${index}" placeholder="{name}-{position}-{YYYYMMDD}.txt">
      <label>下载内容处理指令</label>
      <textarea data-field="downloadPrompt" data-index="${index}" placeholder="例如：移除简历中的联系方式和姓名。" rows="2">${project.downloadPrompt || ''}</textarea>
      <button class="delete-btn" data-index="${index}">删除</button>
    `;
    container.appendChild(div);
  });
}

// 保存配置
async function saveConfig() {
  const apiConfig = {
    endpoint: document.getElementById('apiEndpoint').value,
    model: document.getElementById('apiModel').value,
    apiKey: document.getElementById('apiKey').value
  };
  
  const projectItems = document.querySelectorAll('.project-item');
  const projects = Array.from(projectItems).map((item, index) => {
    return {
      id: `project_${Date.now()}_${index}`,
      name: item.querySelector('[data-field="name"]').value,
      prompt: item.querySelector('[data-field="prompt"]').value,
      fileNameFormat: item.querySelector('[data-field="fileNameFormat"]').value,
      downloadPrompt: item.querySelector('[data-field="downloadPrompt"]').value,
    };
  }).filter(p => p.name && p.prompt);
  
  await chrome.storage.sync.set({ apiConfig, projects });
  alert('配置已保存');
}

// 导出配置
async function exportConfig() {
    const result = await chrome.storage.sync.get(['projects', 'apiConfig']);
    const configJson = JSON.stringify(result, null, 2);
    const blob = new Blob([configJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boss-ai-helper-config-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// 导入配置
function importConfig(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const config = JSON.parse(e.target.result);
            if (config.apiConfig && config.projects) {
                await chrome.storage.sync.set(config);
                loadConfig(); // 重新加载配置到页面
                alert('配置导入成功！');
            } else {
                alert('配置文件格式不正确。');
            }
        } catch (error) {
            alert('导入失败，文件可能已损坏。');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // 清空，以便再次选择同名文件
}


// --- 事件监听 ---
document.addEventListener('DOMContentLoaded', loadConfig);
document.getElementById('saveConfig').addEventListener('click', saveConfig);
document.getElementById('exportConfigBtn').addEventListener('click', exportConfig);
document.getElementById('importConfigBtn').addEventListener('click', () => document.getElementById('importConfigFile').click());
document.getElementById('importConfigFile').addEventListener('change', importConfig);

document.getElementById('addProject').addEventListener('click', async () => {
  const result = await chrome.storage.sync.get(['projects']);
  const projects = result.projects || [];
  projects.push({ 
      id: `project_${Date.now()}`, 
      name: '', 
      prompt: '', 
      fileNameFormat: '{name}-{position}-{YYYYMMDD}.html',
      downloadPrompt: '请将以下简历内容格式化为纯文本，移除所有个人联系方式（电话、邮箱）。'
  });
  renderProjects(projects);
});

document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const index = parseInt(e.target.dataset.index);
    const result = await chrome.storage.sync.get(['projects']);
    const projects = result.projects || [];
    projects.splice(index, 1);
    renderProjects(projects);
  }
});