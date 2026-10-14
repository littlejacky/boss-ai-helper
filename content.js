// =======================================================
// Boss直聘AI简历助手 - content.js (v0.9 - 打印标题同步最终版)
// =======================================================

let currentResumeText = '';
let currentProjectConfig = {};
let currentApiConfig = {};

// ... triggerPageRendering, getResumeFromPdfViewer, fetchAnalysisReport, fetchStructuredData 等核心函数保持不变 ...
async function triggerPageRendering() {
    try {
        const iframe = document.querySelector('iframe.attachment-box.attachment-iframe');
        if (!iframe) return;
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const pages = iframeDoc.querySelectorAll('.page');
        if (pages.length <= 1) return;
        const viewerContainer = iframeDoc.getElementById('viewerContainer');
        if(viewerContainer) {
            viewerContainer.scrollTop = viewerContainer.scrollHeight;
            await new Promise(resolve => setTimeout(resolve, 100));
            viewerContainer.scrollTop = 0;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        for (const page of pages) {
            page.scrollIntoView({ block: 'center' });
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        if (pages[0]) {
            pages[0].scrollIntoView();
        }
    } catch (e) {
        console.error('强制渲染简历页面时出错:', e);
    }
}
function getResumeFromPdfViewer() {
    try {
        const iframe = document.querySelector('iframe.attachment-box.attachment-iframe');
        if (!iframe) return { success: false, error: '未找到简历预览窗口' };
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const pages = iframeDoc.querySelectorAll('.page');
        if (pages.length === 0) {
            const viewer = iframeDoc.querySelector('#viewer');
            if (viewer) return { success: true, text: viewer.innerText.trim() };
            return { success: false, error: '未找到简历内容容器' };
        }
        let fullText = '';
        pages.forEach((page, pageIndex) => {
            const textSpans = Array.from(page.querySelectorAll('.textLayer > span'));
            if (textSpans.length === 0) {
                 console.warn(`第 ${pageIndex + 1} 页没有找到任何文本内容，可能未被正确渲染。`);
                 return;
            };
            textSpans.sort((a, b) => {
                const topA = parseFloat(a.style.top);
                const topB = parseFloat(b.style.top);
                if (Math.abs(topA - topB) < 2) {
                    const leftA = parseFloat(a.style.left);
                    const leftB = parseFloat(b.style.left);
                    return leftA - leftB;
                }
                return topA - topB;
            });
            let lastTop = -1;
            let lineText = '';
            textSpans.forEach(span => {
                const currentTop = parseFloat(span.style.top);
                const fontSize = parseFloat(span.style.fontSize) || 12; 
                if (lastTop !== -1 && currentTop > lastTop + (fontSize * 0.5)) {
                    fullText += lineText.trim() + '\n';
                    lineText = '';
                }
                lineText += span.innerText;
                lastTop = currentTop;
            });
            fullText += lineText.trim() + '\n';
        });
        const junkPattern = /^[a-f0-9]{30,}/i;
        const lines = fullText.split('\n').filter(line => line.trim() && !junkPattern.test(line.trim()));
        return { success: true, text: lines.join('\n').trim() };
    } catch (e) {
        return { success: false, error: `提取简历时发生错误: ${e.message}` };
    }
}
async function fetchAnalysisReport(resumeText, projectConfig, apiConfig) {
  const prompt = `你是一名资深招聘顾问，请分析以下候选人的简历和岗位要求，输出内容必须严格按照格式：\n\n【快速结论】（简洁总结，不超过5行）\n1. 匹配度评分（1-10分）\n2. 推荐结论（推荐/谨慎推荐/不推荐）\n3. 候选人最突出的2个优点\n4. 候选人最明显的1个不足\n\n请务必只输出【快速结论】，不要输出其他任何内容，要保持简洁。\n\n岗位要求：\n${projectConfig.prompt}\n\n候选人简历：\n${resumeText}`;
  try {
    const response = await fetch(apiConfig.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` }, body: JSON.stringify({ model: apiConfig.model, messages: [{ role: 'user', content: prompt }], temperature: 0.7 }) });
    if (!response.ok) throw new Error(`API请求失败: ${response.status}`);
    const data = await response.json();
    return { success: true, result: data.choices?.[0]?.message?.content || '分析结果为空' };
  } catch (error) {
    return { success: false, error: `分析报告获取失败: ${error.message}` };
  }
}
async function fetchStructuredData(resumeText, apiConfig) {
    const prompt = `你是一个精准的数据提取机器人。从以下简历文本中，严格按照指定的JSON格式，提取所需信息。\n对于任何找不到的信息，必须将对应字段的值设为 null。不要编造信息。\n\n输出的JSON格式:\n{\n  "name": "候选人姓名",\n  "gender": "性别 (男/女)",\n  "phone": "联系电话",\n  "email": "电子邮箱",\n  "idNumber": "身份证号",\n  "school": "最高学历的毕业学校 (例如：清华大学)",\n  "graduationDate": "毕业时间 (格式: YYYY-MM)",\n  "degree": "最高学历 (例如：本科, 硕士, 博士, 大专)",\n  "major": "专业名称",\n  "position": "当前或期望的职位",\n  "workExperienceYears": "总工作年限 (仅数字)"\n}\n\n简历文本：\n${resumeText}`;
    try {
        const response = await fetch(apiConfig.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` }, body: JSON.stringify({ model: apiConfig.model, messages: [{ role: 'user', content: prompt }], temperature: 0.2, response_format: { "type": "json_object" } }) });
        if (!response.ok) throw new Error(`API请求失败: ${response.status}`);
        const data = await response.json();
        const content = JSON.parse(data.choices?.[0]?.message?.content);
        return { success: true, result: content };
    } catch (error) {
        return { success: false, error: `结构化数据提取失败: ${error.message}` };
    }
}
function showResultModal(content, projectName) {
  const existing = document.getElementById('ai-result-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'ai-result-modal';
  modal.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 600px; max-height: 80vh; background: white; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); z-index: 10000; padding: 20px; display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;`;
  modal.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; flex-shrink: 0;">
      <h3 style="margin: 0; color: #333;">简历分析结果 - ${projectName}</h3>
      <button id="close-modal" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">×</button>
    </div>
    <div id="modal-content" style="white-space: pre-wrap; line-height: 1.6; color: #333; overflow-y: auto; flex-grow: 1;">
      ${content}
    </div>
    <div id="modal-footer" style="margin-top: 15px; text-align: right; border-top: 1px solid #eee; padding-top: 10px; flex-shrink: 0;">
      <button id="download-result" style="background: #28a745; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 8px; display: none;">下载简历</button>
      <button id="copy-raw-btn" class="secondary-btn" style="background-color: #6c757d; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 8px; display: none;">复制原文</button>
      <button id="copy-analysis-btn" style="background: #1890ff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-right: 8px; display: none;">复制分析</button>
      <button id="close-modal-btn" style="background: #f0f0f0; color: #666; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">关闭</button>
    </div>
  `;
  const overlay = document.createElement('div');
  overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999;`;
  document.body.appendChild(overlay);
  document.body.appendChild(modal);
  const closeModal = () => { overlay.remove(); modal.remove(); };
  document.getElementById('close-modal').onclick = closeModal;
  document.getElementById('close-modal-btn').onclick = closeModal;
}
async function processResumeForDownload(resumeText, downloadPrompt, apiConfig) {
    if (!downloadPrompt) return { success: true, result: resumeText };
    try {
        const response = await fetch(apiConfig.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiConfig.apiKey}` }, body: JSON.stringify({ model: apiConfig.model, messages: [ { role: "system", content: "你是一个文本处理助手，根据用户的指令，对提供的文本进行处理和格式化，然后只输出处理后的文本结果，不要有任何额外的解释。" }, { role: 'user', content: `${downloadPrompt}\n\n以下是简历原文：\n${resumeText}` } ], temperature: 0.2 }) });
        if (!response.ok) throw new Error(`API请求失败: ${response.status}`);
        const data = await response.json();
        return { success: true, result: data.choices?.[0]?.message?.content || '处理结果为空' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}


// 【已更新】创建HTML内容的函数，增加一个新参数`documentTitle`
function createResumeHtml(processedText, candidateInfo, documentTitle) {
  const getInfo = (value, suffix = '') => value ? value + suffix : '未提供';
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <title>${documentTitle}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; margin: 0 auto; max-width: 800px; padding: 30px; color: #333; }
        h1 { font-size: 2.5em; margin-bottom: 0; border-bottom: 2px solid #eee; padding-bottom: 10px; }
        .subtitle { font-size: 1.1em; color: #666; margin-top: 5px; }
        pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; font-size: 1em; }
      </style>
    </head>
    <body>
      <h1>${getInfo(candidateInfo.name, '的简历')}</h1>
      <p class="subtitle">
        求职意向: ${getInfo(candidateInfo.position)} | 
        工作经验: ${getInfo(candidateInfo.workExperienceYears, '年')} |
        学历: ${getInfo(candidateInfo.degree)}
      </p>
      <hr>
      <pre>${processedText}</pre>
    </body>
    </html>
  `;
}

// 【已更新】下载处理函数，计算出文件名后，将其传递给HTML创建函数
async function handleDownload(candidateInfo) {
    const downloadBtn = document.getElementById('download-result');
    downloadBtn.textContent = '处理中...';
    downloadBtn.disabled = true;

    const downloadResponse = await processResumeForDownload(currentResumeText, currentProjectConfig.downloadPrompt, currentApiConfig);
    
    if (downloadResponse.success) {
        let processedText = downloadResponse.result;
        processedText = processedText.replace(/\(END\)$/, '').trim();

        let fileName = currentProjectConfig.fileNameFormat || '{name}-resume.html';
        const date = new Date();
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        fileName = fileName.replace(/{name}/g, candidateInfo.name || 'Unknown').replace(/{position}/g, candidateInfo.position || 'N/A').replace(/{YYYYMMDD}/g, `${yyyy}${mm}${dd}`);
        
        // 从完整文件名中，提取出不含后缀的标题
        const documentTitle = fileName.replace(/\.html$/i, '');
        
        const htmlContent = createResumeHtml(processedText, candidateInfo, documentTitle);
        const blob = new Blob([htmlContent], {type: 'text/html;charset=utf-8'});
        const url = URL.createObjectURL(blob);
        
        chrome.runtime.sendMessage({ action: 'downloadFile', url: url, filename: fileName }, () => { URL.revokeObjectURL(url); });
    } else {
        alert(`下载处理失败: ${downloadResponse.error}`);
    }

    downloadBtn.textContent = '下载简历';
    downloadBtn.disabled = false;
}

// --- 主逻辑 ---
chrome.runtime.onMessage.addListener(async (request) => {
  if (request.action === 'analyzeResume') {
    
    showResultModal('正在准备简历内容，请稍候...', 'AI分析中');
    await triggerPageRendering();
    
    const resumeResult = getResumeFromPdfViewer();
    if (!resumeResult.success || !resumeResult.text) {
      showResultModal(`错误: ${resumeResult.error || '未能提取到任何简历文本。'}`, '分析失败');
      return;
    }
    currentResumeText = resumeResult.text;
    
    const copyRawBtn = document.getElementById('copy-raw-btn');
    if (copyRawBtn) {
        copyRawBtn.style.display = 'inline-block';
        copyRawBtn.onclick = () => {
            navigator.clipboard.writeText(currentResumeText).then(() => alert('简历原文已复制到剪贴板'));
        };
    }
    
    const modalContent = document.getElementById('modal-content');
    if (modalContent) modalContent.innerText = '简历准备完毕，正在发送给AI分析...';

    try {
      const storage = await chrome.storage.sync.get(['projects', 'apiConfig']);
      currentApiConfig = storage.apiConfig || {};
      if (!currentApiConfig.apiKey) { showResultModal('请先在插件配置中设置API密钥', '配置错误'); return; }
      currentProjectConfig = (storage.projects || []).find(p => p.id === request.projectId);
      if (!currentProjectConfig) { showResultModal('项目配置不存在', '配置错误'); return; }
      
      const analysisPromise = fetchAnalysisReport(currentResumeText, currentProjectConfig, currentApiConfig);
      const dataPromise = fetchStructuredData(currentResumeText, currentApiConfig);
      
      const analysisResponse = await analysisPromise;
      if (modalContent) {
          if (analysisResponse.success) {
            modalContent.innerText = analysisResponse.result;
            const copyAnalysisBtn = document.getElementById('copy-analysis-btn');
            if (copyAnalysisBtn) {
                copyAnalysisBtn.style.display = 'inline-block';
                copyAnalysisBtn.onclick = () => { navigator.clipboard.writeText(analysisResponse.result).then(() => alert('分析结果已复制到剪贴板')); };
            }
          } else {
            modalContent.innerText = `分析失败: ${analysisResponse.error}`;
          }
      }
      
      const dataResponse = await dataPromise;
      if (dataResponse.success) {
        const candidateInfo = dataResponse.result;
        await chrome.storage.local.set({ latestCandidateInfo: candidateInfo });
        const downloadBtn = document.getElementById('download-result');
        if (downloadBtn) {
            downloadBtn.style.display = 'inline-block';
            downloadBtn.onclick = () => handleDownload(candidateInfo);
        }
      } else {
        const footer = document.getElementById('modal-footer');
        if(footer){
            const errorSpan = document.createElement('span');
            errorSpan.style.color = 'red';
            errorSpan.style.fontSize = '12px';
            errorSpan.textContent = '简历信息提取失败，下载/粘贴功能可能不完整。';
            footer.prepend(errorSpan);
        }
      }
    } catch (error) {
      showResultModal(`分析过程出错: ${error.message}`, '错误');
    }
  }
});