// content.js

// 获取iframe中的简历内容
function getResumeFromIframe() {
  const iframe = document.querySelector('iframe.attachment-box.attachment-iframe');
  if (!iframe) {
    return { success: false, error: '未找到简历预览窗口' };
  }
  
  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    const viewer = iframeDoc.querySelector('#viewer');
    
    if (!viewer) {
      return { success: false, error: '简历内容未加载完成' };
    }
    
    const resumeText = viewer.innerText.trim();
    return { 
      success: true, 
      text: resumeText,
      length: resumeText.length
    };
  } catch (e) {
    return { success: false, error: '无法访问简历内容，可能是跨域限制' };
  }
}

// 从简历文本中提取关键信息
function extractResumeInfo(resumeText) {
  const info = {
    name: '',
    experience: '',
    title: '',
    skills: '',
    education: '',
    age: ''
  };

  // 简单的正则匹配提取信息
  const nameMatch = resumeText.match(/姓名[：:]\s*([^\n\r]+)|^([^\n\r]{2,4})\s*[男女]?/m);
  if (nameMatch) {
    info.name = (nameMatch[1] || nameMatch[2] || '').trim();
  }

  const expMatch = resumeText.match(/(\d+)\s*年[工作经验]|工作经验[：:]\s*(\d+)/);
  if (expMatch) {
    info.experience = expMatch[1] || expMatch[2] || '';
  }

  const titleMatch = resumeText.match(/求职意向[：:]\s*([^\n\r]+)|期望职位[：:]\s*([^\n\r]+)/);
  if (titleMatch) {
    info.title = (titleMatch[1] || titleMatch[2] || '').trim();
  }

  const ageMatch = resumeText.match(/年龄[：:]\s*(\d+)|(\d{4})\s*年.*?生/);
  if (ageMatch) {
    if (ageMatch[1]) {
      info.age = ageMatch[1];
    } else if (ageMatch[2]) {
      const birthYear = parseInt(ageMatch[2]);
      info.age = String(new Date().getFullYear() - birthYear);
    }
  }

  const eduMatch = resumeText.match/(本科|硕士|博士|大专|高中|中专)/);
  if (eduMatch) {
    info.education = eduMatch[1];
  }

  // 提取技能关键词
  const skillKeywords = resumeText.match(/(Excel|Python|SQL|Java|JavaScript|React|Vue|数据分析|项目管理|团队管理)/gi);
  if (skillKeywords) {
    info.skills = [...new Set(skillKeywords)].join(',');
  }

  return info;
}

// 调用AI分析
async function analyzeWithAI(resumeText, projectConfig, apiConfig) {
  const prompt = `
你是一名专业的招聘顾问，请分析以下候选人的简历。

【重要格式要求】
请务必按照以下格式输出，先给出最简洁的推荐结论，再进行详细分析：

==== 推荐结论 ====
推荐结果：[推荐/谨慎推荐/不推荐]
理由：[用最简洁的1-2句话说明推荐/不推荐的核心原因]

==== 详细分析 ====
【匹配度评分】
评分：X/10分

【快速总结】
• 突出优势：[列出2-3个最突出的优点]
• 主要不足：[列出1-2个明显的不足]

【深入分析】
• 优势分析：[展开说明候选人的优势]
• 不足之处：[详细分析存在的问题]
• 面试建议：[给出具体的面试重点]
• 简历改进建议：[如有需要，提出改进建议]

岗位要求：
${projectConfig.prompt}

候选人简历：
${resumeText}
`;

  try {
    const response = await fetch(apiConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: apiConfig.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || '分析结果为空';
    
    // 检查是否为推荐结果
    const isRecommended = /推荐结果[：:]\s*(推荐|谨慎推荐)/.test(result);
    
    return {
      success: true,
      result: result,
      isRecommended: isRecommended
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      isRecommended: false
    };
  }
}

// 格式化简历并下载
async function formatAndDownloadResume(resumeText, projectConfig, apiConfig, resumeInfo) {
  const formatPrompt = `
${projectConfig.formatPrompt}

请将以下简历整理为标准格式的Word文档内容，要求：
1. 去除所有联系方式（电话、邮箱、地址等）
2. 去除期望薪资相关信息
3. 保持专业的排版格式
4. 突出与岗位相关的经验和技能
5. 使用清晰的标题和段落结构

原始简历：
${resumeText}
`;

  try {
    const response = await fetch(apiConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiConfig.apiKey}`
      },
      body: JSON.stringify({
        model: apiConfig.model,
        messages: [{ role: 'user', content: formatPrompt }],
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const formattedContent = data.choices?.[0]?.message?.content || '格式化失败';
    
    // 生成文件名
    let fileName = projectConfig.downloadTemplate || `【${projectConfig.name}】候选人简历_\${name}`;
    
    // 替换模板变量
    Object.keys(resumeInfo).forEach(key => {
      const value = resumeInfo[key] || '未知';
      fileName = fileName.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    });
    
    // 确保文件名有效
    fileName = fileName.replace(/[<>:"/\\|?*]/g, '_') + '.txt';
    
    // 创建并下载文件
    const blob = new Blob([formattedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return { success: true, fileName };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 显示分析结果的浮窗
function showResultModal(content, projectName, isRecommended = false, resumeText = '', projectConfig = null, apiConfig = null) {
  // 移除已存在的模态框
  const existing = document.getElementById('ai-result-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'ai-result-modal';
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 650px;
    max-height: 85vh;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    z-index: 10000;
    padding: 24px;
    overflow-y: auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const downloadButton = isRecommended ? `
    <button id="download-resume" style="background: #52c41a; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 8px;">
      下载简历
    </button>
  ` : '';

  modal.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 2px solid #f0f0f0; padding-bottom: 12px;">
      <h3 style="margin: 0; color: #333; font-size: 18px;">简历分析结果 - ${projectName}</h3>
      <button id="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999; padding: 4px;">×</button>
    </div>
    <div id="analysis-content" style="white-space: pre-wrap; line-height: 1.8; color: #333; max-height: 55vh; overflow-y: auto; font-size: 14px;">
      ${content}
    </div>
    <div style="margin-top: 20px; text-align: right; border-top: 1px solid #f0f0f0; padding-top: 16px;">
      ${downloadButton}
      <button id="copy-result" style="background: #1890ff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 8px;">
        复制结果
      </button>
      <button id="close-modal-btn" style="background: #f5f5f5; color: #666; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
        关闭
      </button>
    </div>
  `;

  // 添加遮罩层
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.6);
    z-index: 9999;
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  // 绑定事件
  const closeModal = () => {
    overlay.remove();
    modal.remove();
  };

  document.getElementById('close-modal').onclick = closeModal;
  document.getElementById('close-modal-btn').onclick = closeModal;
  overlay.onclick = closeModal;

  // 复制功能
  document.getElementById('copy-result').onclick = () => {
    navigator.clipboard.writeText(content).then(() => {
      const btn = document.getElementById('copy-result');
      const originalText = btn.textContent;
      btn.textContent = '已复制';
      btn.style.background = '#52c41a';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '#1890ff';
      }, 1500);
    });
  };

  // 下载功能
  if (isRecommended && document.getElementById('download-resume')) {
    document.getElementById('download-resume').onclick = async () => {
      const btn = document.getElementById('download-resume');
      const originalText = btn.textContent;
      btn.textContent = '处理中...';
      btn.disabled = true;
      btn.style.background = '#95de64';

      try {
        const resumeInfo = extractResumeInfo(resumeText);
        const result = await formatAndDownloadResume(resumeText, projectConfig, apiConfig, resumeInfo);
        
        if (result.success) {
          btn.textContent = '下载成功';
          btn.style.background = '#52c41a';
          setTimeout(() => {
            btn.textContent = originalText;
            btn.disabled = false;
            btn.style.background = '#52c41a';
          }, 2000);
        } else {
          throw new Error(result.error);
        }
      } catch (error) {
        alert(`下载失败: ${error.message}`);
        btn.textContent = originalText;
        btn.disabled = false;
        btn.style.background = '#52c41a';
      }
    };
  }
}

// 监听来自background的消息
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.action === 'analyzeResume') {
    // 获取简历内容
    const resumeResult = getResumeFromIframe();
    
    if (!resumeResult.success) {
      showResultModal(`错误: ${resumeResult.error}`, '分析失败');
      return;
    }

    // 显示加载状态
    showResultModal('正在分析简历，请稍候...', 'AI分析中');

    try {
      // 获取配置
      const storage = await chrome.storage.sync.get(['projects', 'apiConfig']);
      const projects = storage.projects || [];
      const apiConfig = storage.apiConfig || {};

      if (!apiConfig.apiKey) {
        showResultModal('请先在插件配置中设置API密钥', '配置错误');
        return;
      }

      const project = projects.find(p => p.id === request.projectId);
      if (!project) {
        showResultModal('项目配置不存在', '配置错误');
        return;
      }

      // 调用AI分析
      const analysisResult = await analyzeWithAI(resumeResult.text, project, apiConfig);
      
      if (analysisResult.success) {
        showResultModal(
          analysisResult.result, 
          project.name, 
          analysisResult.isRecommended,
          resumeResult.text,
          project,
          apiConfig
        );
      } else {
        showResultModal(`分析失败: ${analysisResult.error}`, '错误');
      }
    } catch (error) {
      showResultModal(`分析过程出错: ${error.message}`, '错误');
    }
  }
});