// 默认API配置（不含apiKey，apiKey需用户手动填写）
const DEFAULT_API_CONFIG = {
  endpoint: 'https://ai.maxitai.cn/v1/chat/completions',
  model: 'gpt-5-mini',
  apiKey: ''
};

// 加载配置
async function loadConfig() {
  const result = await chrome.storage.sync.get(['projects', 'apiConfig']);
  const apiConfig = result.apiConfig || DEFAULT_API_CONFIG;
  document.getElementById('apiEndpoint').value = apiConfig.endpoint || DEFAULT_API_CONFIG.endpoint;
  document.getElementById('apiModel').value = apiConfig.model || DEFAULT_API_CONFIG.model;
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
      <input type="text" value="${project.name}" data-field="name" data-index="${index}" placeholder="项目名称">
      <textarea data-field="prompt" data-index="${index}" placeholder="分析提示词" rows="3">${project.prompt}</textarea>
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
    const name = item.querySelector('[data-field="name"]').value;
    const prompt = item.querySelector('[data-field="prompt"]').value;
    return {
      id: `project_${index}`,
      name,
      prompt
    };
  }).filter(p => p.name && p.prompt);
  
  await chrome.storage.sync.set({ apiConfig, projects });
  alert('配置已保存');
}

// 事件监听
document.addEventListener('DOMContentLoaded', loadConfig);

document.getElementById('addProject').addEventListener('click', async () => {
  const result = await chrome.storage.sync.get(['projects']);
  const projects = result.projects || [];
  projects.push({ id: `project_${Date.now()}`, name: '', prompt: '' });
  renderProjects(projects);
});

document.getElementById('saveConfig').addEventListener('click', saveConfig);

document.addEventListener('click', async (e) => {
  if (e.target.classList.contains('delete-btn')) {
    const index = parseInt(e.target.dataset.index);
    const result = await chrome.storage.sync.get(['projects']);
    const projects = result.projects || [];
    projects.splice(index, 1);
    renderProjects(projects);
  }
});