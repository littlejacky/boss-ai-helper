// config.js

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
      <button class="delete-btn" data-index="${index}">删除</button>
      <div class="form-group">
        <label>项目名称</label>
        <input type="text" data-field="name" value="${project.name || ''}" placeholder="如：数据分析岗位">
      </div>
      <div class="form-group">
        <label>分析提示词</label>
        <textarea data-field="prompt" rows="3" placeholder="重点评估候选人的...">${project.prompt || ''}</textarea>
      </div>
      <div class="form-group">
        <label>下载文件名模板</label>
        <input type="text" data-field="downloadTemplate" value="${project.downloadTemplate || ''}" placeholder="【项目名】候选人简历_\${name}_\${experience}年经验">
        <div class="template-vars">可用变量：\${name}(姓名), \${experience}(经验), \${title}(职位), \${skills}(技能), \${education}(学历), \${age}(年龄)</div>
      </div>
      <div class="form-group">
        <label>简历格式化提示词</label>
        <textarea data-field="formatPrompt" rows="2" placeholder="请整理为标准简历格式，去除联系方式和期望薪资...">${project.formatPrompt || ''}</textarea>
        <div class="form-help">用于生成下载版本简历的格式化要求</div>
      </div>
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
    const downloadTemplate = item.querySelector('[data-field="downloadTemplate"]').value;
    const formatPrompt = item.querySelector('[data-field="formatPrompt"]').value;
    return {
      id: `project_${index}`,
      name,
      prompt,
      downloadTemplate: downloadTemplate || `【${name}】候选人简历_\${name}`,
      formatPrompt: formatPrompt || '请整理为标准简历格式，去除联系方式和期望薪资'
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
  projects.push({ 
    id: `project_${Date.now()}`, 
    name: '', 
    prompt: '', 
    downloadTemplate: '',
    formatPrompt: ''
  });
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