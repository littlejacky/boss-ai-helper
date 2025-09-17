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

// 调用AI分析
async function analyzeWithAI(resumeText, projectConfig, apiConfig) {
  const prompt = `
你是一名招聘顾问，请分析以下候选人的简历和岗位要求，输出内容必须严格按照格式：

【快速结论】（简洁总结，不超过5行）
1. 匹配度评分（1-10分）
2. 推荐结论（推荐/谨慎推荐/不推荐）
3. 候选人最突出的2个优点
4. 候选人最明显的1个不足

【详细分析】（展开说明，用于HR参考）
- 优势分析
- 不足之处
- 面试建议
- 简历改进建议

请务必先输出【快速结论】，再输出【详细分析】，不要混在一起。

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
    return {
      success: true,
      result: data.choices?.[0]?.message?.content || '分析结果为空'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// 显示分析结果的浮窗
function showResultModal(content, projectName) {
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
    width: 600px;
    max-height: 80vh;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    z-index: 10000;
    padding: 20px;
    overflow-y: auto;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  modal.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px;">
      <h3 style="margin: 0; color: #333;">简历分析结果 - ${projectName}</h3>
      <button id="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">×</button>
    </div>
    <div style="white-space: pre-wrap; line-height: 1.6; color: #333; max-height: 60vh; overflow-y: auto;">
      ${content}
    </div>
    <div style="margin-top: 15px; text-align: right; border-top: 1px solid #eee; padding-top: 10px;">
      <button id="copy-result" style="background: #1890ff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 8px;">复制结果</button>
      <button id="close-modal-btn" style="background: #f0f0f0; color: #666; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">关闭</button>
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
    background: rgba(0,0,0,0.5);
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
      alert('结果已复制到剪贴板');
    });
  };
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
        showResultModal(analysisResult.result, project.name);
      } else {
        showResultModal(`分析失败: ${analysisResult.error}`, '错误');
      }
    } catch (error) {
      showResultModal(`分析过程出错: ${error.message}`, '错误');
    }
  }
});